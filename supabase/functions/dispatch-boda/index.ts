import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonRecord = Record<string, unknown>;

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGIN?: string;
}

interface DispatchResult {
  rider_id: string;
  rider_phone: string | null;
  pickup: JsonRecord;
  dropoff: JsonRecord;
  already_assigned: boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_BODY_BYTES = 8_192;

function requiredEnv(name: keyof Env): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function json(body: unknown, status: number, origin = ""): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedOrigin(request: Request, configured: string): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const values = configured.split(",").map((value) => value.trim()).filter(Boolean);
  return values.includes(origin) ? origin : null;
}

function bearer(request: Request): string | null {
  const value = request.headers.get("Authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

async function bodyJson(request: Request): Promise<JsonRecord> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new Error("request too large");
  const value: unknown = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid body");
  return value as JsonRecord;
}

async function derivedKey(orderId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`dispatch:${orderId}`));
  return `dispatch-${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function isValidKey(value: string | null): value is string {
  return value !== null && IDEMPOTENCY_PATTERN.test(value);
}

function isServiceRequest(request: Request, serviceKey: string): boolean {
  return bearer(request) === serviceKey;
}

async function authorizedStaff(
  request: Request,
  admin: SupabaseClient,
): Promise<boolean> {
  const token = bearer(request);
  if (!token) return false;
  const userClient = createClient(requiredEnv("SUPABASE_URL"), Deno.env.get("SUPABASE_ANON_KEY") ?? requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return false;
  const { data: profile } = await admin.from("profiles").select("role,is_active").eq("id", data.user.id).maybeSingle();
  return Boolean(profile && profile.is_active && (profile.role === "admin" || profile.role === "pharmacist"));
}

function normalizeResult(value: unknown): DispatchResult | null {
  const result = Array.isArray(value) ? value[0] : value;
  if (!result || typeof result !== "object") return null;
  const item = result as Record<string, unknown>;
  if (typeof item.rider_id !== "string" || !item.pickup || !item.dropoff) return null;
  return {
    rider_id: item.rider_id,
    rider_phone: typeof item.rider_phone === "string" ? item.rider_phone : null,
    pickup: item.pickup as JsonRecord,
    dropoff: item.dropoff as JsonRecord,
    already_assigned: item.already_assigned === true,
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

  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(requiredEnv("SUPABASE_URL"), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (!isServiceRequest(request, serviceKey) && !(await authorizedStaff(request, admin))) {
    return json({ error: "permission denied" }, 403, origin ?? "");
  }

  let body: JsonRecord;
  try {
    body = await bodyJson(request);
  } catch {
    return json({ error: "invalid request" }, 400, origin ?? "");
  }
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!UUID_PATTERN.test(orderId)) return json({ error: "invalid order id" }, 400, origin ?? "");
  const suppliedKey = request.headers.get("Idempotency-Key") ?? (typeof body.idempotencyKey === "string" ? body.idempotencyKey : null);
  const idempotencyKey = isValidKey(suppliedKey) ? suppliedKey : await derivedKey(orderId);

  const { data, error } = await admin.rpc("dispatch_order", {
    p_order_id: orderId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("no_riders_available")) return json({ error: "no riders available" }, 503, origin ?? "");
    if (message.includes("already assigned")) return json({ error: "order already dispatched" }, 409, origin ?? "");
    if (message.includes("not found")) return json({ error: "order not found" }, 404, origin ?? "");
    return json({ error: "dispatch failed" }, 500, origin ?? "");
  }
  const result = normalizeResult(data);
  if (!result) return json({ error: "invalid dispatch response" }, 502, origin ?? "");

  return json({
    rider_id: result.rider_id,
    rider_phone: result.rider_phone,
    pickup: result.pickup,
    dropoff: result.dropoff,
    already_assigned: result.already_assigned,
  }, result.already_assigned ? 200 : 201, origin ?? "");
});
