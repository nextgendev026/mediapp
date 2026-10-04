interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  MPESA_CONSUMER_KEY: string;
  MPESA_CONSUMER_SECRET: string;
  MPESA_PASSKEY: string;
  MPESA_SHORTCODE: string;
  MPESA_ENVIRONMENT: "sandbox" | "production";
  MPESA_BASE_URL?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  SUPABASE_ANON_KEY?: string;
  CALLBACK_BASE_URL: string;
  MPESA_CALLBACK_SECRET?: string;
  ALLOW_UNSIGNED_MPESA_CALLBACKS?: string;
  ALLOWED_ORIGIN?: string;
  RATE_LIMITER?: RateLimiter;
}

type JsonRecord = Record<string, unknown>;

interface StkRequest {
  phone: string;
  amount: number;
  orderId: string;
  orderNumber: string;
}

interface OrderRow {
  id: string;
  order_number: string;
  patient_id: string | null;
  pharmacy_id: string | null;
  prescription_id: string | null;
  total_kes: number;
  payment_status: string;
  mpesa_checkout_request_id: string | null;
}

interface PaymentRow {
  id: string;
  order_id: string | null;
  provider_reference: string | null;
  amount_kes: number;
  status: string;
  callback_payload: JsonRecord | null;
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFERENCE_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
let tokenCache: { token: string; expiresAt: number } | null = null;

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
  headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");
  return headers;
}

function validOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  const allowed = (env.ALLOWED_ORIGIN ?? "https://afyacommerce.co.ke").split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.includes(origin);
}

function baseUrl(env: Env): string {
  const value = new URL(env.SUPABASE_URL);
  if (value.protocol !== "https:" && !(value.protocol === "http:" && ["localhost", "127.0.0.1"].includes(value.hostname))) {
    throw new Error("invalid Supabase URL");
  }
  return value.toString().replace(/\/$/, "");
}

function normalizePhone(value: string): string | null {
  const digits = value.replace(/[\s()-]/g, "");
  const normalized = digits.startsWith("+") ? digits : digits.startsWith("0") ? `+254${digits.slice(1)}` : digits.startsWith("254") ? `+${digits}` : `+254${digits}`;
  return /^\+254[17]\d{8}$/.test(normalized) ? normalized : null;
}

function bearer(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

async function userId(request: Request, env: Env): Promise<string | null> {
  const token = bearer(request);
  if (!token) return null;
  const response = await fetch(`${baseUrl(env)}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const data = await response.json() as { id?: unknown };
  return typeof data.id === "string" && UUID_PATTERN.test(data.id) ? data.id : null;
}

async function rest(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("apikey", env.SUPABASE_SERVICE_KEY);
  headers.set("Authorization", `Bearer ${env.SUPABASE_SERVICE_KEY}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl(env)}/rest/v1/${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(10_000),
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
  if (!response.ok) throw new HttpError(response.status, typeof data === "object" && data && "message" in data ? String((data as { message: unknown }).message) : "Supabase request failed");
  return data;
}

async function readJson(request: Request, maxBytes = 32_768): Promise<JsonRecord> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > maxBytes) throw new HttpError(413, "request too large");
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new HttpError(415, "JSON required");
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new HttpError(400, "invalid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "invalid body");
  return value as JsonRecord;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function orderById(value: unknown): OrderRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const order = value as Record<string, unknown>;
  if (typeof order.id !== "string" || typeof order.order_number !== "string") return null;
  return {
    id: order.id,
    order_number: order.order_number,
    patient_id: typeof order.patient_id === "string" ? order.patient_id : null,
    pharmacy_id: typeof order.pharmacy_id === "string" ? order.pharmacy_id : null,
    prescription_id: typeof order.prescription_id === "string" ? order.prescription_id : null,
    total_kes: Number(order.total_kes),
    payment_status: typeof order.payment_status === "string" ? order.payment_status : "pending",
    mpesa_checkout_request_id: typeof order.mpesa_checkout_request_id === "string" ? order.mpesa_checkout_request_id : null,
  };
}

async function orderForRequest(env: Env, orderId: string, user: string): Promise<OrderRow> {
  const result = await rest(env, `orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,patient_id,pharmacy_id,prescription_id,total_kes,payment_status,mpesa_checkout_request_id`);
  const order = Array.isArray(result) ? orderById(result[0]) : null;
  if (!order) throw new HttpError(404, "order not found");
  const profileResult = await rest(env, `profiles?id=eq.${encodeURIComponent(user)}&select=role,pharmacy_id`);
  const profile = Array.isArray(profileResult) ? profileResult[0] as Record<string, unknown> | undefined : undefined;
  const role = typeof profile?.role === "string" ? profile.role : "";
  if (role === "admin" || role === "pharmacist" && order.pharmacy_id === profile?.pharmacy_id) return order;
  if (role === "provider" && order.prescription_id) {
    const prescription = await rest(env, `prescriptions?id=eq.${encodeURIComponent(order.prescription_id)}&select=provider_id,providers(profile_id)`);
    const provider = Array.isArray(prescription) ? prescription[0] as Record<string, unknown> | undefined : undefined;
    const providerRelation = provider?.providers as { profile_id?: string } | null;
    if (providerRelation?.profile_id === user) return order;
  }
  if (order.patient_id) {
    const patient = await rest(env, `patients?id=eq.${encodeURIComponent(order.patient_id)}&select=profile_id`);
    const patientRow = Array.isArray(patient) ? patient[0] as Record<string, unknown> | undefined : undefined;
    if (patientRow?.profile_id === user) return order;
  }
  throw new HttpError(403, "order access denied");
}

async function hasAccess(env: Env, order: OrderRow, user: string): Promise<boolean> {
  try {
    await orderForRequest(env, order.id, user);
    return true;
  } catch {
    return false;
  }
}

async function mpesaToken(env: Env): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  const host = env.MPESA_BASE_URL ?? (env.MPESA_ENVIRONMENT === "sandbox" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke");
  const response = await fetch(`${host.replace(/\/$/, "")}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Authorization: `Basic ${btoa(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`)}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new HttpError(502, "M-PESA authentication failed");
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new HttpError(502, "M-PESA authentication response invalid");
  const expiresIn = Math.max(60, Math.min(data.expires_in ?? 300, 3_600));
  tokenCache = { token: data.access_token, expiresAt: Date.now() + expiresIn * 1_000 };
  return tokenCache.token;
}

async function stkPush(env: Env, body: StkRequest): Promise<JsonRecord> {
  const token = await mpesaToken(env);
  const host = env.MPESA_BASE_URL ?? (env.MPESA_ENVIRONMENT === "sandbox" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke");
  const response = await fetch(`${host.replace(/\/$/, "")}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      BusinessShortcode: env.MPESA_SHORTCODE,
      Password: env.MPESA_PASSKEY,
      Timestamp: new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"),
      TransactionType: "CustomerPayBill",
      Amount: Math.round(body.amount),
      PartyA: env.MPESA_SHORTCODE,
      PartyB: env.MPESA_SHORTCODE,
      PhoneNumber: body.phone.replace(/^\+254/, "0"),
      CallbackURL: `${env.CALLBACK_BASE_URL.replace(/\/$/, "")}/api/mpesa/callback`,
      AccountReference: body.orderNumber.slice(0, 20),
      TransactionDesc: `AfyaCommerce ${body.orderNumber}`.slice(0, 120),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let data: JsonRecord = {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as JsonRecord;
  } catch {
    data = { response: text.slice(0, 500) };
  }
  if (!response.ok) throw new HttpError(502, "M-PESA request failed");
  return data;
}

function transactionById(value: unknown): PaymentRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string") return null;
  return {
    id: row.id,
    order_id: typeof row.order_id === "string" ? row.order_id : null,
    provider_reference: typeof row.provider_reference === "string" ? row.provider_reference : null,
    amount_kes: Number(row.amount_kes),
    status: typeof row.status === "string" ? row.status : "unknown",
    callback_payload: row.callback_payload && typeof row.callback_payload === "object" ? row.callback_payload as JsonRecord : null,
  };
}

async function existingTransaction(env: Env, key: string): Promise<PaymentRow | null> {
  const result = await rest(env, `payment_transactions?idempotency_key=eq.${encodeURIComponent(key)}&select=id,order_id,provider_reference,amount_kes,status,callback_payload`);
  return Array.isArray(result) ? transactionById(result[0]) : null;
}

async function rateLimit(request: Request, env: Env, scope: string): Promise<boolean> {
  if (!env.RATE_LIMITER) return true;
  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const result = await env.RATE_LIMITER.limit({ key: `${scope}:${ip}` });
  return result.success;
}

function callbackAuthorized(request: Request, env: Env): boolean {
  if (env.ALLOW_UNSIGNED_MPESA_CALLBACKS === "true" && !env.MPESA_CALLBACK_SECRET) return true;
  const secret = env.MPESA_CALLBACK_SECRET;
  if (!secret) return false;
  const url = new URL(request.url);
  const supplied = request.headers.get("X-MPESA-Callback-Secret") ?? url.searchParams.get("callback_token") ?? "";
  return supplied.length > 0 && supplied === secret;
}

async function handleStkPush(request: Request, env: Env, headers: Headers): Promise<Response> {
  const body = await readJson(request);
  const user = await userId(request, env);
  if (!user) throw new HttpError(401, "authentication required");
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
  const amount = Number(body.amount);
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber : "";
  if (!phone || !Number.isInteger(amount) || amount < 1 || amount > 1_000_000 || !UUID_PATTERN.test(orderId) || !REFERENCE_PATTERN.test(orderNumber)) {
    throw new HttpError(400, "invalid payment request");
  }
  const order = await orderForRequest(env, orderId, user);
  if (order.order_number !== orderNumber || Math.abs(order.total_kes - amount) > 0.01 || order.payment_status === "paid") {
    throw new HttpError(409, "order is not payable");
  }
  const suppliedKey = request.headers.get("Idempotency-Key");
  if (suppliedKey && !IDEMPOTENCY_PATTERN.test(suppliedKey)) throw new HttpError(400, "invalid idempotency key");
  const key = suppliedKey ?? `mpesa-${await sha256(`${orderId}:${phone}:${amount}`)}`;
  const existing = await existingTransaction(env, key);
  if (existing) {
    if (existing.status === "succeeded" || existing.status === "failed" || existing.status === "reversed") {
      return json({ status: existing.status, CheckoutRequestID: existing.provider_reference }, 200, headers);
    }
    if (existing.provider_reference) return json({ status: existing.status, CheckoutRequestID: existing.provider_reference }, 200, headers);
    throw new HttpError(409, "payment initiation already in progress");
  }

  let inserted: PaymentRow | null = null;
  try {
    const result = await rest(env, "payment_transactions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        order_id: orderId,
        provider: "mpesa",
        amount_kes: amount,
        status: "initiated",
        idempotency_key: key,
        request_payload: { phone, order_number: orderNumber },
      }),
    });
    inserted = Array.isArray(result) ? transactionById(result[0]) : null;
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      const raced = await existingTransaction(env, key);
      if (raced?.provider_reference) return json({ status: raced.status, CheckoutRequestID: raced.provider_reference }, 200, headers);
    }
    throw error;
  }
  if (!inserted) throw new HttpError(500, "payment could not be initialized");

  let response: JsonRecord;
  try {
    response = await stkPush(env, { phone, amount, orderId, orderNumber });
  } catch {
    await rest(env, `payment_transactions?id=eq.${encodeURIComponent(inserted.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "failed", callback_payload: { error: "provider_request_failed" }, updated_at: new Date().toISOString() }),
    });
    throw new HttpError(502, "M-PESA request failed");
  }
  const checkoutId = typeof response.CheckoutRequestID === "string" ? response.CheckoutRequestID : null;
  if (!checkoutId || !REFERENCE_PATTERN.test(checkoutId)) {
    await rest(env, `payment_transactions?id=eq.${encodeURIComponent(inserted.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
        callback_payload: { error: "invalid_provider_response", response },
        updated_at: new Date().toISOString(),
      }),
    });
    throw new HttpError(502, "M-PESA response invalid");
  }
  await rest(env, `payment_transactions?id=eq.${encodeURIComponent(inserted.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      provider_reference: checkoutId,
      status: "pending",
      request_payload: { phone, order_number: orderNumber, provider_response: response },
      updated_at: new Date().toISOString(),
    }),
  });
  await rest(env, `orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    body: JSON.stringify({ mpesa_checkout_request_id: checkoutId, payment_method: "mpesa" }),
  });
  return json({
    CheckoutRequestID: checkoutId,
    MerchantRequestID: typeof response.MerchantRequestID === "string" ? response.MerchantRequestID : null,
    ResponseCode: typeof response.ResponseCode === "string" ? response.ResponseCode : "0",
    CustomerMessage: typeof response.CustomerMessage === "string" ? response.CustomerMessage : "Payment prompt requested",
  }, 200, headers);
}

async function handleCallback(request: Request, env: Env, headers: Headers): Promise<Response> {
  if (!callbackAuthorized(request, env)) throw new HttpError(401, "callback authentication failed");
  const body = await readJson(request);
  const root = body.Body as Record<string, unknown> | undefined;
  const callback = root?.stkCallback as Record<string, unknown> | undefined;
  if (!callback) throw new HttpError(400, "invalid callback");
  const checkoutId = typeof callback.CheckoutRequestID === "string" ? callback.CheckoutRequestID : "";
  const resultCode = Number(callback.ResultCode);
  if (!REFERENCE_PATTERN.test(checkoutId) || !Number.isInteger(resultCode)) throw new HttpError(400, "invalid callback");
  const result = await rest(env, `payment_transactions?provider=eq.mpesa&provider_reference=eq.${encodeURIComponent(checkoutId)}&select=id,order_id,provider_reference,amount_kes,status,callback_payload`);
  const transaction = Array.isArray(result) ? transactionById(result[0]) : null;
  if (!transaction?.order_id) return new Response("OK", { status: 200, headers });
  const callbackAmount = callback.Amount === undefined ? transaction.amount_kes : Number(callback.Amount);
  if (!Number.isFinite(callbackAmount) || Math.abs(callbackAmount - transaction.amount_kes) > 0.01) {
    await rest(env, `payment_transactions?id=eq.${encodeURIComponent(transaction.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "failed", callback_payload: { ResultCode: resultCode, validation_error: "amount_mismatch" } }),
    });
    return new Response("OK", { status: 200, headers });
  }
  const success = resultCode === 0;
  await rest(env, `payment_transactions?id=eq.${encodeURIComponent(transaction.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: success ? "succeeded" : "failed",
      callback_payload: body,
      updated_at: new Date().toISOString(),
    }),
  });
  await rest(env, `orders?id=eq.${encodeURIComponent(transaction.order_id)}&payment_status=eq.pending`, {
    method: "PATCH",
    body: JSON.stringify({
      payment_status: success ? "paid" : "failed",
      ...(success && typeof callback.MpesaReceiptNumber === "string" ? { mpesa_receipt_number: callback.MpesaReceiptNumber } : {}),
    }),
  });
  return new Response("OK", { status: 200, headers });
}

async function handleStatus(request: Request, env: Env, url: URL, headers: Headers): Promise<Response> {
  const user = await userId(request, env);
  if (!user) throw new HttpError(401, "authentication required");
  const reference = decodeURIComponent(url.pathname.slice("/api/mpesa/status/".length));
  if (!REFERENCE_PATTERN.test(reference)) throw new HttpError(400, "invalid reference");
  const result = await rest(env, `payment_transactions?provider=eq.mpesa&provider_reference=eq.${encodeURIComponent(reference)}&select=id,order_id,provider_reference,amount_kes,status,callback_payload`);
  const transaction = Array.isArray(result) ? transactionById(result[0]) : null;
  if (!transaction?.order_id) return json({ status: "unknown" }, 404, headers);
  const orderData = await rest(env, `orders?id=eq.${encodeURIComponent(transaction.order_id)}&select=id,order_number,patient_id,pharmacy_id,prescription_id,total_kes,payment_status,mpesa_checkout_request_id`);
  const order = Array.isArray(orderData) ? orderById(orderData[0]) : null;
  if (!order || !(await hasAccess(env, order, user))) throw new HttpError(403, "payment access denied");
  const callback = transaction.callback_payload as { Body?: { stkCallback?: { MpesaReceiptNumber?: unknown } } } | null;
  const receipt = callback?.Body?.stkCallback?.MpesaReceiptNumber;
  return json({
    status: transaction.status,
    mpesa_receipt: typeof receipt === "string" ? receipt : undefined,
  }, 200, headers);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(request, env);
    if (!validOrigin(request, env)) return json({ error: "origin not allowed" }, 403, headers);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/mpesa/stk-push" && request.method === "POST") {
        if (!(await rateLimit(request, env, "mpesa"))) throw new HttpError(429, "rate limit exceeded");
        return await handleStkPush(request, env, headers);
      }
      if (url.pathname === "/api/mpesa/callback" && request.method === "POST") {
        if (!(await rateLimit(request, env, "mpesa-callback"))) throw new HttpError(429, "rate limit exceeded");
        return await handleCallback(request, env, headers);
      }
      if (url.pathname.startsWith("/api/mpesa/status/") && request.method === "GET") {
        if (!(await rateLimit(request, env, "mpesa-status"))) throw new HttpError(429, "rate limit exceeded");
        return await handleStatus(request, env, url, headers);
      }
      return json({ error: "not found" }, 404, headers);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status, headers);
      return json({ error: "payment service unavailable" }, 503, headers);
    }
  },
};
