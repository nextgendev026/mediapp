interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  SUPABASE_ANON_KEY?: string;
  DISPATCH_API_TOKEN?: string;
  DISPATCH_OTP_SECRET?: string;
  PROOF_STORAGE_BUCKET?: string;
  DISPATCH_EVENTS?: KVNamespace;
  SMS_QUEUE?: { send(message: JsonRecord): Promise<void> };
  ALLOWED_ORIGIN?: string;
}

type JsonRecord = Record<string, unknown>;
type Role = "patient" | "provider" | "pharmacist" | "admin" | "rider";

interface Principal {
  service: boolean;
  userId: string | null;
  role: Role | null;
  pharmacyId: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status: number, headers: Headers): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGIN ?? "https://afyacommerce.co.ke").split(",").map((value) => value.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");
  return headers;
}

function validOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return (env.ALLOWED_ORIGIN ?? "https://afyacommerce.co.ke").split(",").map((value) => value.trim()).filter(Boolean).includes(origin);
}

function baseUrl(env: Env): string {
  const value = new URL(env.SUPABASE_URL);
  if (value.protocol !== "https:" && !(value.protocol === "http:" && ["localhost", "127.0.0.1"].includes(value.hostname))) throw new Error("invalid Supabase URL");
  return value.toString().replace(/\/$/, "");
}

function bearer(request: Request): string | null {
  const value = request.headers.get("Authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

async function readBody(request: Request, maxBytes = 24_576): Promise<JsonRecord> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > maxBytes) throw new HttpError(413, "request too large");
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new HttpError(415, "JSON required");
  const value: unknown = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "invalid body");
  return value as JsonRecord;
}

function decodeBase64Image(value: unknown): Uint8Array {
  if (typeof value !== "string" || value.length === 0 || value.length > 5_600_000) throw new HttpError(400, "invalid image payload");
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,/.exec(value);
  const encoded = match ? value.slice(match[0].length) : value;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new HttpError(400, "invalid image encoding");
  let bytes: Uint8Array;
  try {
    const binary = atob(encoded);
    bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  } catch {
    throw new HttpError(400, "invalid image encoding");
  }
  if (bytes.length < 1024 || bytes.length > 4 * 1024 * 1024) throw new HttpError(413, "image is too large");
  return bytes;
}

async function rest(env: Env, path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("apikey", env.SUPABASE_SERVICE_KEY);
  headers.set("Authorization", `Bearer ${env.SUPABASE_SERVICE_KEY}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl(env)}/rest/v1/${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(12_000),
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : "Supabase request failed";
    throw new HttpError(response.status, message);
  }
  return data;
}

async function principal(request: Request, env: Env): Promise<Principal | null> {
  const token = bearer(request);
  if (!token) return null;
  if (env.DISPATCH_API_TOKEN && token === env.DISPATCH_API_TOKEN) return { service: true, userId: null, role: "admin", pharmacyId: null };
  if (!env.SUPABASE_ANON_KEY) return null;
  const userClient = createUserClient(env, token);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  const profiles = await rest(env, `profiles?id=eq.${encodeURIComponent(data.user.id)}&select=role,pharmacy_id,is_active`);
  const row = orderFrom(profiles);
  if (!row || row.is_active !== true || typeof row.role !== "string") return null;
  return {
    service: false,
    userId: data.user.id,
    role: row.role as Role,
    pharmacyId: typeof row.pharmacy_id === "string" ? row.pharmacy_id : null,
  };
}

function createUserClient(env: Env, token: string) {
  return {
    auth: {
      getUser: async () => {
        const response = await fetch(`${baseUrl(env)}/auth/v1/user`, {
          headers: { apikey: env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, Accept: "application/json" },
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) return { data: { user: null }, error: true };
        const data = await response.json() as { id?: unknown };
        return typeof data.id === "string" ? { data: { user: { id: data.id } }, error: null } : { data: { user: null }, error: true };
      },
    },
  };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalSecret(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function idempotencyKey(request: Request, body: JsonRecord, orderId: string): string {
  const supplied = request.headers.get("Idempotency-Key") ?? (typeof body.idempotencyKey === "string" ? body.idempotencyKey : null);
  if (supplied && !IDEMPOTENCY_PATTERN.test(supplied)) throw new HttpError(400, "invalid idempotency key");
  return supplied ?? `dispatch-${orderId}`;
}

function orderIdFrom(value: unknown): string {
  if (!isUuid(value)) throw new HttpError(400, "invalid order id");
  return value;
}

function orderFrom(value: unknown): JsonRecord | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" && !Array.isArray(row) ? row as JsonRecord : null;
}

async function dispatchOrder(env: Env, orderId: string, key: string): Promise<JsonRecord> {
  const cacheKey = `dispatch:${key}`;
  if (env.DISPATCH_EVENTS) {
    const cached = await env.DISPATCH_EVENTS.get(cacheKey);
    if (cached) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(cached);
      } catch {
        await env.DISPATCH_EVENTS.delete(cacheKey);
      }
      if (parsed && typeof parsed === "object" && (parsed as JsonRecord).status === "processing") {
        throw new HttpError(409, "dispatch already in progress");
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as JsonRecord;
    }
    await env.DISPATCH_EVENTS.put(cacheKey, JSON.stringify({ status: "processing" }), { expirationTtl: 900 });
  }
  let data: unknown;
  try {
    data = await rest(env, "rpc/dispatch_order", {
      method: "POST",
      body: JSON.stringify({ p_order_id: orderId, p_idempotency_key: key }),
    });
  } catch (error) {
    if (env.DISPATCH_EVENTS) await env.DISPATCH_EVENTS.delete(cacheKey);
    throw error;
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result !== "object") {
    if (env.DISPATCH_EVENTS) await env.DISPATCH_EVENTS.delete(cacheKey);
    throw new HttpError(502, "invalid dispatch response");
  }
  const value = result as JsonRecord;
  if (!isUuid(value.rider_id)) {
    if (env.DISPATCH_EVENTS) await env.DISPATCH_EVENTS.delete(cacheKey);
    throw new HttpError(502, "dispatch response missing rider");
  }
  const response = {
    rider_id: value.rider_id,
    pickup: value.pickup ?? null,
    dropoff: value.dropoff ?? null,
    already_assigned: value.already_assigned === true,
  };
  if (env.DISPATCH_EVENTS) await env.DISPATCH_EVENTS.put(cacheKey, JSON.stringify(response), { expirationTtl: 86_400 });
  return response;
}

async function notifyPatient(
  env: Env,
  orderId: string,
  type: "otp" | "order_dispatched" | "order_delivered",
  buildMessage: (orderNumber: string) => string,
  idempotencyKey: string,
): Promise<void> {
  if (!env.SMS_QUEUE) return;
  try {
    const data = await rest(env, `orders?id=eq.${encodeURIComponent(orderId)}&select=order_number,patients(profile_id)`);
    const order = orderFrom(data);
    const patient = orderFrom(order?.patients);
    const profileId = patient?.profile_id;
    if (!isUuid(profileId)) return;
    const profiles = await rest(env, `profiles?id=eq.${encodeURIComponent(profileId)}&select=phone`);
    const profile = orderFrom(profiles);
    const phone = typeof profile?.phone === "string" ? profile.phone : "";
    if (!/^[0-9+\s()-]{7,20}$/.test(phone)) return;
    const orderNumber = typeof order?.order_number === "string" ? order.order_number : orderId;
    await env.SMS_QUEUE.send({
      to: phone,
      type,
      message: buildMessage(orderNumber).slice(0, 400),
      idempotencyKey,
    });
  } catch {
    return;
  }
}

function randomOtp(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return String(buffer[0] % 1_000_000).padStart(6, "0");
}

async function initializeOtp(env: Env, orderId: string): Promise<void> {
  if (!env.DISPATCH_OTP_SECRET) throw new HttpError(503, "delivery OTP verification is not configured");
  if (!env.SMS_QUEUE) throw new HttpError(503, "SMS delivery is not configured");
  const otp = randomOtp();
  const hash = await sha256(`${env.DISPATCH_OTP_SECRET}:${otp}`);
  await rest(env, `orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    body: JSON.stringify({ delivery_otp_hash: hash }),
  });
  await notifyPatient(
    env,
    orderId,
    "otp",
    (orderNumber) => `AfyaCommerce: your delivery verification code for order ${orderNumber} is ${otp}. Share it only with the rider on delivery.`,
    `otp-${orderId}`,
  );
}

async function canAccessOrder(env: Env, order: JsonRecord, actor: Principal): Promise<boolean> {
  if (actor.service || actor.role === "admin") return true;
  if (actor.role === "rider" && order.rider_id === actor.userId) return true;
  if (actor.role === "pharmacist" && order.pharmacy_id === actor.pharmacyId) return true;
  if (actor.role === "patient" && isUuid(order.patient_id)) {
    const result = await rest(env, `patients?id=eq.${encodeURIComponent(order.patient_id)}&select=profile_id`);
    const patient = Array.isArray(result) ? result[0] as Record<string, unknown> | undefined : undefined;
    return patient?.profile_id === actor.userId;
  }
  return false;
}

async function acceptOrder(env: Env, orderId: string, riderId: string, actor: Principal): Promise<JsonRecord> {
  if (!isUuid(riderId)) throw new HttpError(400, "invalid rider id");
  if (!actor.service && (actor.role !== "rider" || actor.userId !== riderId)) throw new HttpError(403, "permission denied");
  const data = await rest(env, "rpc/accept_dispatch_order", {
    method: "POST",
    body: JSON.stringify({ p_order_id: orderId, p_rider_profile_id: riderId }),
  });
  const order = orderFrom(data);
  if (!order) throw new HttpError(502, "invalid acceptance response");
  return { id: order.id, delivery_status: order.delivery_status, rider_id: order.rider_id };
}

function validPhotoUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.length > 0;
  } catch {
    return false;
  }
}

async function uploadProofPhoto(env: Env, orderId: string, body: JsonRecord, actor: Principal): Promise<JsonRecord> {
  if (!actor.service && actor.role !== "rider") throw new HttpError(403, "permission denied");
  if (!isUuid(actor.userId)) throw new HttpError(403, "permission denied");
  if (!env.PROOF_STORAGE_BUCKET) throw new HttpError(503, "proof photo storage is not configured");
  const orderData = await rest(env, `orders?id=eq.${encodeURIComponent(orderId)}&select=id,rider_id,delivery_status`);
  const order = orderFrom(orderData);
  if (!order || order.rider_id !== actor.userId) throw new HttpError(404, "assigned order not found");
  if (order.delivery_status === "delivered") throw new HttpError(409, "delivery proof was already recorded");
  const bytes = decodeBase64Image(body.image);
  const contentType = body.contentType === "image/png" ? "image/png" : body.contentType === "image/webp" ? "image/webp" : "image/jpeg";
  const path = `${orderId}/${crypto.randomUUID()}.${contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg"}`;
  const uploaded = await fetch(`${baseUrl(env)}/storage/v1/object/${encodeURIComponent(env.PROOF_STORAGE_BUCKET)}/${path}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body: bytes as unknown as BodyInit,
    signal: AbortSignal.timeout(20_000),
  });
  if (!uploaded.ok) throw new HttpError(502, "photo could not be stored");
  return { url: `${baseUrl(env)}/storage/v1/object/public/${encodeURIComponent(env.PROOF_STORAGE_BUCKET)}/${path}`, path };
}

async function submitProof(env: Env, orderId: string, body: JsonRecord, actor: Principal): Promise<JsonRecord> {
  if (!env.DISPATCH_OTP_SECRET) throw new HttpError(503, "delivery OTP verification is not configured");
  const riderId = actor.service && isUuid(body.riderProfileId) ? body.riderProfileId : actor.userId;
  if (!isUuid(riderId) || (!actor.service && actor.role !== "rider")) throw new HttpError(403, "permission denied");
  const photoUrl = body.photoUrl;
  const otp = typeof body.otp === "string" ? body.otp : "";
  const gps = body.gps && typeof body.gps === "object" ? body.gps as JsonRecord : null;
  const lat = Number(gps?.lat);
  const lng = Number(gps?.lng);
  const deliveredAt = typeof body.deliveredAt === "string" ? Date.parse(body.deliveredAt) : Date.now();
  if (!validPhotoUrl(photoUrl) || !/^\d{6}$/.test(otp) || !gps || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || !Number.isFinite(deliveredAt)) {
    throw new HttpError(400, "photo, OTP and GPS proof are required");
  }
  const orderData = await rest(env, `orders?id=eq.${encodeURIComponent(orderId)}&select=id,rider_id,delivery_otp_hash,delivery_status`);
  const order = orderFrom(orderData);
  if (!order || order.rider_id !== riderId) throw new HttpError(404, "assigned order not found");
  if (typeof order.delivery_otp_hash !== "string" || !order.delivery_otp_hash) throw new HttpError(409, "delivery OTP is not initialized");
  const suppliedHash = await sha256(`${env.DISPATCH_OTP_SECRET}:${otp}`);
  if (!equalSecret(suppliedHash, order.delivery_otp_hash)) throw new HttpError(403, "invalid delivery OTP");
  const data = await rest(env, "rpc/record_delivery_proof", {
    method: "POST",
    body: JSON.stringify({
      p_order_id: orderId,
      p_rider_profile_id: riderId,
      p_photo_url: photoUrl,
      p_otp_verified: true,
      p_gps_lat: lat,
      p_gps_lng: lng,
      p_delivered_at: new Date(deliveredAt).toISOString(),
    }),
  });
  const result = orderFrom(data);
  if (!result) throw new HttpError(502, "invalid proof response");
  await notifyPatient(env, orderId, "order_delivered", (orderNumber) => `AfyaCommerce: order ${orderNumber} was delivered. Thank you for shopping with us.`, `delivered-${orderId}`);
  return { id: result.id, delivery_status: result.delivery_status, delivered_at: result.proof_of_delivery };
}

async function listRiderOrders(env: Env, actor: Principal): Promise<JsonRecord> {
  if (!actor.service && actor.role !== "rider") throw new HttpError(403, "permission denied");
  if (!isUuid(actor.userId)) throw new HttpError(403, "permission denied");
  const select = "id,order_number,delivery_status,delivery_method,delivery_address,proof_of_delivery,created_at,pharmacies(name,physical_address,county,gps_lat,gps_lng)";
  const data = await rest(env, `orders?rider_id=eq.${encodeURIComponent(actor.userId)}&select=${select}&order=created_at.desc`);
  const orders = Array.isArray(data) ? data as JsonRecord[] : [];
  return {
    orders: orders.map((order) => ({
      id: order.id,
      order_number: order.order_number,
      delivery_status: order.delivery_status,
      delivery_method: order.delivery_method,
      delivery_address: order.delivery_address ?? null,
      proof_of_delivery: order.proof_of_delivery ?? null,
      pharmacy: order.pharmacies ?? null,
      created_at: order.created_at ?? null,
    })),
  };
}

async function updateAvailability(env: Env, body: JsonRecord, actor: Principal): Promise<JsonRecord> {
  if (!actor.service && actor.role !== "rider") throw new HttpError(403, "permission denied");
  if (!isUuid(actor.userId)) throw new HttpError(403, "permission denied");
  const available = body.isAvailable;
  if (typeof available !== "boolean") throw new HttpError(400, "isAvailable must be true or false");
  const lat = body.lat === undefined || body.lat === null ? null : Number(body.lat);
  const lng = body.lng === undefined || body.lng === null ? null : Number(body.lng);
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) throw new HttpError(400, "invalid latitude");
  if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) throw new HttpError(400, "invalid longitude");
  if (available) {
    const current = await rest(env, `riders?profile_id=eq.${encodeURIComponent(actor.userId)}&select=id,county,transport_licence_expiry&limit=1`);
    const rider = orderFrom(current);
    if (!rider) throw new HttpError(404, "rider record not found");
    if (typeof rider.transport_licence_expiry !== "string" || rider.transport_licence_expiry < new Date().toISOString().slice(0, 10)) {
      throw new HttpError(409, "transport licence has expired");
    }
  }
  const data = await rest(env, `riders?profile_id=eq.${encodeURIComponent(actor.userId)}&select=id,is_available,county,transport_licence_expiry`, {
    headers: { Prefer: "return=representation" },
    method: "PATCH",
    body: JSON.stringify({
      is_available: available,
      current_lat: lat,
      current_lng: lng,
      last_ping_at: new Date().toISOString(),
    }),
  });
  const rider = orderFrom(data);
  if (!rider) throw new HttpError(404, "rider record not found");
  return { is_available: available, county: rider.county ?? null, last_ping_at: new Date().toISOString() };
}

async function handleFetch(request: Request, env: Env): Promise<Response> {
  const headers = corsHeaders(request, env);
  if (!validOrigin(request, env)) return json({ error: "origin not allowed" }, 403, headers);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const actor = await principal(request, env);
  if (!actor) return json({ error: "authentication required" }, 401, headers);
  const url = new URL(request.url);
  try {
    const dispatchMatch = url.pathname.match(/^\/(?:api\/)?dispatch(?:\/orders)?$/);
    const jobsMatch = url.pathname.match(/^\/(?:api\/)?dispatch\/orders$/);
    const availabilityMatch = url.pathname.match(/^\/(?:api\/)?dispatch\/availability$/);
    const orderMatch = url.pathname.match(/^\/(?:api\/)?dispatch\/orders\/([0-9a-f-]+)$/i);
    const acceptMatch = url.pathname.match(/^\/(?:api\/)?dispatch\/orders\/([0-9a-f-]+)\/accept$/i);
    const proofMatch = url.pathname.match(/^\/(?:api\/)?dispatch\/orders\/([0-9a-f-]+)\/proof$/i);
    const proofPhotoMatch = url.pathname.match(/^\/(?:api\/)?dispatch\/orders\/([0-9a-f-]+)\/proof\/photo$/i);
    if (request.method === "POST" && dispatchMatch) {
      if (!actor.service && actor.role !== "admin" && actor.role !== "pharmacist") throw new HttpError(403, "permission denied");
      const body = await readBody(request);
      const orderId = orderIdFrom(body.orderId);
      if (actor.role === "pharmacist") {
        const orderData = await rest(env, `orders?id=eq.${encodeURIComponent(orderId)}&select=id,pharmacy_id`);
        const order = orderFrom(orderData);
        if (!order) throw new HttpError(404, "order not found");
        if (order.pharmacy_id !== actor.pharmacyId) throw new HttpError(403, "permission denied");
      }
      const key = idempotencyKey(request, body, orderId);
      const result = await dispatchOrder(env, orderId, key);
      if (!result.already_assigned) {
        await initializeOtp(env, orderId);
        await notifyPatient(env, orderId, "order_dispatched", (orderNumber) => `AfyaCommerce: a rider has been assigned to order ${orderNumber}. Track your delivery in the app.`, `${key}-dispatched`);
      }
      return json(result, result.already_assigned ? 200 : 201, headers);
    }
    if (request.method === "GET" && jobsMatch) {
      return json(await listRiderOrders(env, actor), 200, headers);
    }
    if (request.method === "POST" && availabilityMatch) {
      const body = await readBody(request);
      return json(await updateAvailability(env, body, actor), 200, headers);
    }
    if (request.method === "POST" && acceptMatch) {
      const orderId = orderIdFrom(acceptMatch[1]);
      const body = await readBody(request);
      const riderId = actor.service && typeof body.riderProfileId === "string" ? body.riderProfileId : actor.userId ?? "";
      return json(await acceptOrder(env, orderId, riderId, actor), 200, headers);
    }
    if (request.method === "POST" && proofPhotoMatch) {
      const orderId = orderIdFrom(proofPhotoMatch[1]);
      const body = await readBody(request, 5_600_000);
      return json(await uploadProofPhoto(env, orderId, body, actor), 200, headers);
    }
    if (request.method === "POST" && proofMatch) {
      const orderId = orderIdFrom(proofMatch[1]);
      const body = await readBody(request);
      return json(await submitProof(env, orderId, body, actor), 200, headers);
    }
    if (request.method === "GET" && orderMatch) {
      const orderId = orderIdFrom(orderMatch[1]);
      const data = await rest(env, `orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,patient_id,pharmacy_id,rider_id,delivery_status,delivery_method,proof_of_delivery`);
      const order = orderFrom(data);
      if (!order) throw new HttpError(404, "order not found");
      if (!(await canAccessOrder(env, order, actor))) throw new HttpError(403, "permission denied");
      return json({
        id: order.id,
        order_number: order.order_number,
        delivery_status: order.delivery_status,
        delivery_method: order.delivery_method,
        rider_id: order.rider_id,
        proof_of_delivery: order.proof_of_delivery ?? null,
      }, 200, headers);
    }
    return json({ error: "not found" }, 404, headers);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status, headers);
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("no_riders_available")) return json({ error: "no riders available" }, 503, headers);
    if (message.includes("not found")) return json({ error: "order not found" }, 404, headers);
    return json({ error: "dispatch service unavailable" }, 503, headers);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleFetch(request, env);
  },

  async queue(batch: { messages: Array<{ id: string; body: unknown; ack(): void; retry(): void }> }, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const body = message.body && typeof message.body === "object" && !Array.isArray(message.body) ? message.body as JsonRecord : null;
      const orderId = body?.orderId;
      if (!isUuid(orderId)) {
        message.ack();
        continue;
      }
      const suppliedKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : null;
      const key = suppliedKey && IDEMPOTENCY_PATTERN.test(suppliedKey) ? suppliedKey : `queue-${orderId}`;
      try {
        await dispatchOrder(env, orderId, key);
        message.ack();
      } catch {
        message.retry();
      }
    }
  },
};
