import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonRecord = Record<string, unknown>;

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  AUDIT_INTERNAL_SECRET?: string;
  ALLOWED_ORIGIN?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESOURCE_TYPES = new Set([
  "profile",
  "patient",
  "prescription",
  "consultation",
  "order",
  "payment",
  "consent",
  "inventory",
  "audit",
]);
const ACTIONS = new Set(["READ", "CREATE", "UPDATE", "DELETE", "DISPENSE", "EXPORT", "LOGIN", "LOGOUT"]);
const PURPOSES = new Set(["treatment", "payment", "audit", "admin", "support", "research"]);
const MAX_BODY_BYTES = 16_384;

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

function originFor(request: Request, configured: string): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = configured.split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function tokenFrom(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function internalAuthorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const value = request.headers.get("X-Audit-Internal-Secret") ?? "";
  return value.length > 0 && value === secret;
}

async function readBody(request: Request): Promise<JsonRecord> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new Error("request too large");
  const value: unknown = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid body");
  return value as JsonRecord;
}

function stringValue(body: JsonRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") return value.trim();
  }
  return "";
}

function firstForwardedIp(request: Request): string | null {
  const value = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return value.length <= 64 ? value || null : null;
}

serve(async (request: Request): Promise<Response> => {
  const configuredOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "https://afyacommerce.co.ke";
  const origin = originFor(request, configuredOrigin);
  if (request.headers.has("Origin") && !origin) return json({ error: "origin not allowed" }, 403);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Audit-Internal-Secret",
      },
    });
  }
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405, origin ?? "");

  let body: JsonRecord;
  try {
    body = await readBody(request);
  } catch {
    return json({ error: "invalid request" }, 400, origin ?? "");
  }

  const action = stringValue(body, "action").toUpperCase();
  const resourceType = stringValue(body, "resourceType", "resource_type").toLowerCase();
  const resourceIdValue = stringValue(body, "resourceId", "resource_id");
  const purpose = stringValue(body, "purpose").toLowerCase() || "treatment";
  const phiAccessed = body.phiAccessed === true || body.phi_accessed === true;
  const metadata = body.metadata;
  if (!ACTIONS.has(action) || !RESOURCE_TYPES.has(resourceType) || !PURPOSES.has(purpose)) {
    return json({ error: "invalid audit event" }, 400, origin ?? "");
  }
  if (resourceIdValue && !UUID_PATTERN.test(resourceIdValue)) {
    return json({ error: "invalid resource id" }, 400, origin ?? "");
  }
  if (metadata !== undefined && (!metadata || typeof metadata !== "object" || Array.isArray(metadata))) {
    return json({ error: "invalid metadata" }, 400, origin ?? "");
  }
  if (metadata !== undefined && new TextEncoder().encode(JSON.stringify(metadata)).byteLength > 8_192) {
    return json({ error: "metadata too large" }, 400, origin ?? "");
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const userToken = tokenFrom(request);
  const internal = internalAuthorized(request, Deno.env.get("AUDIT_INTERNAL_SECRET"));
  if (!userToken && !internal) return json({ error: "authentication required" }, 401, origin ?? "");

  if (internal && !userToken) {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const actorId = stringValue(body, "actorId", "actor_id");
    if (!UUID_PATTERN.test(actorId)) return json({ error: "actor id required" }, 400, origin ?? "");
    const { data, error } = await admin.from("audit_log").insert({
      actor_id: actorId,
      actor_role: stringValue(body, "actorRole", "actor_role") || null,
      action,
      resource_type: resourceType,
      resource_id: resourceIdValue || null,
      phi_accessed: phiAccessed,
      purpose,
      ip_address: firstForwardedIp(request),
      user_agent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
      metadata: metadata ?? {},
    }).select("id").single();
    if (error || !data) return json({ error: "audit logging failed" }, 500, origin ?? "");
    return json({ id: data.id }, 201, origin ?? "");
  }

  const userClient = createClient(supabaseUrl, requiredEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "authentication required" }, 401, origin ?? "");
  const { data, error } = await userClient.rpc("record_audit_event", {
    p_action: action,
    p_resource_type: resourceType,
    p_resource_id: resourceIdValue || null,
    p_phi_accessed: phiAccessed,
    p_purpose: purpose,
    p_ip_address: firstForwardedIp(request),
    p_user_agent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
    p_metadata: metadata ?? {},
  });
  if (error || typeof data !== "string") return json({ error: "audit logging failed" }, 500, origin ?? "");
  return json({ id: data }, 201, origin ?? "");
});
