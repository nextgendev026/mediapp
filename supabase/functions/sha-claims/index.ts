import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonRecord = Record<string, unknown>;

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SHA_API_BASE_URL: string;
  SHA_CLIENT_ID: string;
  SHA_CLIENT_SECRET: string;
  SHA_TOKEN_URL?: string;
  SHA_CLAIMS_PATH?: string;
  ALLOWED_ORIGIN?: string;
}

interface ClaimRow {
  id: string;
  prescription_id: string;
  patient_id: string;
  member_number: string;
  service_code: string;
  amount_kes: number;
  external_claim_id: string | null;
  status: "submitted" | "approved" | "rejected" | "failed";
  response_payload: JsonRecord | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_BODY_BYTES = 16_384;
let tokenCache: { token: string; expiresAt: number } | null = null;

function requiredEnv(name: keyof Env): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function json(body: unknown, status: number, origin = ""): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedOrigin(request: Request, configured: string): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  return configured.split(",").map((value) => value.trim()).filter(Boolean).includes(origin) ? origin : null;
}

function bearer(request: Request): string | null {
  const value = request.headers.get("Authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

async function readJson(request: Request): Promise<JsonRecord> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new Error("request too large");
  const value: unknown = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid body");
  return value as JsonRecord;
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isServiceRequest(request: Request, serviceKey: string): boolean {
  return bearer(request) === serviceKey;
}

async function getUser(request: Request): Promise<string | null> {
  const token = bearer(request);
  if (!token) return null;
  const client = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  return !error && data.user ? data.user.id : null;
}

async function shaToken(config: {
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  tokenUrl?: string;
}): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  const base = config.apiBaseUrl.replace(/\/$/, "");
  const tokenUrl = config.tokenUrl ?? `${base}/oauth/token`;
  if (!tokenUrl.startsWith("https://") && !tokenUrl.startsWith(base)) throw new Error("invalid SHA token url");
  const response = await fetch(tokenUrl, {
    method: "POST",
    redirect: "manual",
    headers: {
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("SHA authentication failed");
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("SHA authentication response invalid");
  const expiresIn = Math.max(60, Math.min(data.expires_in ?? 300, 3_600));
  tokenCache = { token: data.access_token, expiresAt: Date.now() + expiresIn * 1_000 };
  return tokenCache.token;
}

function normalizeClaim(value: unknown): ClaimRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.prescription_id !== "string" || typeof row.patient_id !== "string") return null;
  return {
    id: row.id,
    prescription_id: row.prescription_id,
    patient_id: row.patient_id,
    member_number: typeof row.member_number === "string" ? row.member_number : "",
    service_code: typeof row.service_code === "string" ? row.service_code : "",
    amount_kes: Number(row.amount_kes ?? 0),
    external_claim_id: typeof row.external_claim_id === "string" ? row.external_claim_id : null,
    status: row.status === "approved" || row.status === "rejected" || row.status === "failed" ? row.status : "submitted",
    response_payload: row.response_payload && typeof row.response_payload === "object" ? row.response_payload as JsonRecord : null,
  };
}

async function isAuthorized(
  request: Request,
  prescription: Record<string, unknown>,
  admin: SupabaseClient,
  serviceKey: string,
): Promise<boolean> {
  if (isServiceRequest(request, serviceKey)) return true;
  const userId = await getUser(request);
  if (!userId) return false;
  const { data: profile } = await admin.from("profiles").select("role,pharmacy_id,is_active").eq("id", userId).maybeSingle();
  if (!profile?.is_active) return false;
  const patient = prescription.patients as { profile_id?: string } | null;
  const provider = prescription.providers as { profile_id?: string } | null;
  if (profile.role === "admin") return true;
  if (profile.role === "patient") return patient?.profile_id === userId;
  if (profile.role === "provider") return provider?.profile_id === userId;
  return profile.role === "pharmacist" && profile.pharmacy_id === prescription.pharmacy_id;
}

function claimResponse(row: ClaimRow): JsonRecord {
  return {
    id: row.id,
    prescription_id: row.prescription_id,
    status: row.status,
    external_claim_id: row.external_claim_id,
  };
}

serve(async (request: Request): Promise<Response> => {
  const configuredOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "https://afyacommerce.co.ke";
  const origin = allowedOrigin(request, configuredOrigin);
  if (request.headers.has("Origin") && !origin) return json({ error: "origin not allowed" }, 403);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
      },
    });
  }
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405, origin ?? "");

  let body: JsonRecord;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "invalid request" }, 400, origin ?? "");
  }
  const prescriptionId = typeof body.prescriptionId === "string" ? body.prescriptionId : "";
  const memberNumber = typeof body.memberNumber === "string" ? body.memberNumber.trim().toUpperCase() : "";
  const serviceCode = typeof body.serviceCode === "string" ? body.serviceCode.trim().toUpperCase() : "";
  const amount = Number(body.amountKes ?? body.amount_kes ?? body.amountKcs ?? body.amount);
  if (!isUuid(prescriptionId) || !/^[A-Z0-9/-]{4,64}$/.test(memberNumber) || !/^[A-Z0-9._-]{2,64}$/.test(serviceCode) || !Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    return json({ error: "invalid claim request" }, 400, origin ?? "");
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: prescriptionData, error: prescriptionError } = await admin
    .from("prescriptions")
    .select("id,patient_id,provider_id,pharmacy_id,patients(profile_id),providers(profile_id)")
    .eq("id", prescriptionId)
    .maybeSingle();
  if (prescriptionError || !prescriptionData) return json({ error: "prescription not found" }, 404, origin ?? "");
  if (!(await isAuthorized(request, prescriptionData, admin, serviceKey))) return json({ error: "permission denied" }, 403, origin ?? "");

  const suppliedKey = request.headers.get("Idempotency-Key") ?? (typeof body.idempotencyKey === "string" ? body.idempotencyKey : null);
  const idempotencyKey = suppliedKey && IDEMPOTENCY_PATTERN.test(suppliedKey)
    ? suppliedKey
    : `sha-${prescriptionId}-${memberNumber}`.slice(0, 128);
  const { data: existingData } = await admin.from("sha_claims").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
  const existing = normalizeClaim(existingData);
  if (existing) return json(claimResponse(existing), 200, origin ?? "");

  const patientId = typeof prescriptionData.patient_id === "string" ? prescriptionData.patient_id : "";
  if (!isUuid(patientId)) return json({ error: "prescription has no patient" }, 422, origin ?? "");
  const requestPayload = {
    member_number: memberNumber,
    service_code: serviceCode,
    amount_kes: amount,
    prescription_reference: prescriptionId,
  };
  const { data: inserted, error: insertError } = await admin
    .from("sha_claims")
    .insert({
      prescription_id: prescriptionId,
      patient_id: patientId,
      member_number: memberNumber,
      service_code: serviceCode,
      amount_kes: amount,
      request_payload: requestPayload,
      idempotency_key: idempotencyKey,
      status: "submitted",
    })
    .select("*")
    .single();
  if (insertError || !inserted) {
    const { data: raced } = await admin.from("sha_claims").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
    const racedClaim = normalizeClaim(raced);
    if (racedClaim) return json(claimResponse(racedClaim), 200, origin ?? "");
    return json({ error: "claim could not be created" }, 500, origin ?? "");
  }
  const claim = normalizeClaim(inserted);
  if (!claim) return json({ error: "claim response invalid" }, 502, origin ?? "");

  try {
    const base = requiredEnv("SHA_API_BASE_URL").replace(/\/$/, "");
    const claimsPath = (Deno.env.get("SHA_CLAIMS_PATH") ?? "/claims").replace(/^\/+/, "/");
    const accessToken = await shaToken({
      apiBaseUrl: base,
      clientId: requiredEnv("SHA_CLIENT_ID"),
      clientSecret: requiredEnv("SHA_CLIENT_SECRET"),
      ...(Deno.env.get("SHA_TOKEN_URL") ? { tokenUrl: Deno.env.get("SHA_TOKEN_URL")! } : {}),
    });
    const response = await fetch(`${base}${claimsPath}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(20_000),
    });
    const responseText = await response.text();
    let responsePayload: JsonRecord = {};
    try {
      const parsed: unknown = JSON.parse(responseText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) responsePayload = parsed as JsonRecord;
    } catch {
      responsePayload = { response: responseText.slice(0, 2_000) };
    }
    if (!response.ok) throw new Error("SHA claim rejected");
    const externalId = typeof responsePayload.claim_id === "string"
      ? responsePayload.claim_id
      : typeof responsePayload.claimId === "string"
      ? responsePayload.claimId
      : typeof responsePayload.id === "string"
      ? responsePayload.id
      : null;
    const status = responsePayload.status === "approved" || responsePayload.status === "rejected" ? responsePayload.status : "submitted";
    const { data: updated, error: updateError } = await admin
      .from("sha_claims")
      .update({ external_claim_id: externalId, status, response_payload: responsePayload })
      .eq("id", claim.id)
      .select("*")
      .single();
    if (updateError || !updated) throw new Error("claim persistence failed");
    await admin.from("prescriptions").update({ sha_claim_status: "submitted" }).eq("id", prescriptionId);
    const result = normalizeClaim(updated);
    return json(claimResponse(result ?? claim), 201, origin ?? "");
  } catch {
    await admin.from("sha_claims").update({ status: "failed", response_payload: { error: "provider_request_failed" } }).eq("id", claim.id);
    return json({ error: "SHA provider request failed" }, 502, origin ?? "");
  }
});
