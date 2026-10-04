interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  HIE_BASE_URL: string;
  HIE_CLIENT_ID: string;
  HIE_CLIENT_SECRET: string;
  HIE_TOKEN_CACHE?: KVNamespace;
  HIE_REQUEST_CACHE?: KVNamespace;
  HIE_INGRESS_TOKEN?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  ALLOWED_ORIGIN?: string;
  RATE_LIMITER?: RateLimiter;
}

const RESOURCE_TYPES = new Set([
  "Patient",
  "Practitioner",
  "PractitionerRole",
  "Organization",
  "HealthcareService",
  "MedicationRequest",
  "Medication",
  "Observation",
  "Condition",
  "AllergyIntolerance",
  "DiagnosticReport",
  "Bundle",
]);
const QUERY_KEYS = new Set([
  "_id",
  "_lastUpdated",
  "_profile",
  "_security",
  "_source",
  "_sort",
  "_count",
  "_include",
  "_revinclude",
  "_summary",
  "_total",
  "_search",
  "identifier",
  "patient",
  "subject",
  "practitioner",
  "author",
  "request",
  "medication",
  "code",
  "status",
  "date",
  "name",
  "family",
  "given",
  "telecom",
  "address",
  "location",
  "general-practitioner",
  "condition",
]);
const ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_BODY_BYTES = 1_048_576;
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
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, If-Match, If-None-Match, Idempotency-Key");
  return headers;
}

function validOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  const allowed = (env.ALLOWED_ORIGIN ?? "https://afyacommerce.co.ke").split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.includes(origin);
}

function bearer(request: Request): string | null {
  const value = request.headers.get("Authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

function equalSecret(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function authorized(request: Request, env: Env): Promise<boolean> {
  const token = bearer(request);
  if (!token) return false;
  if (env.HIE_INGRESS_TOKEN && equalSecret(token, env.HIE_INGRESS_TOKEN)) return true;
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;
  const base = new URL(env.SUPABASE_URL);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) return false;
  const response = await fetch(`${base.toString().replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8_000),
  });
  return response.ok;
}

function upstreamBase(env: Env): URL {
  const base = new URL(env.HIE_BASE_URL);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) throw new Error("invalid HIE URL");
  base.username = "";
  base.password = "";
  base.hash = "";
  base.search = "";
  return base;
}

async function hieToken(env: Env, base: URL): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  if (env.HIE_TOKEN_CACHE) {
    const cached = await env.HIE_TOKEN_CACHE.get("hie-access-token");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { token?: unknown; expiresAt?: unknown };
        if (typeof parsed.token === "string" && typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now() + 30_000) {
          tokenCache = { token: parsed.token, expiresAt: parsed.expiresAt };
          return parsed.token;
        }
      } catch {
        await env.HIE_TOKEN_CACHE.delete("hie-access-token");
      }
    }
  }
  const tokenUrl = new URL(`${base.toString().replace(/\/$/, "")}/auth/token`);
  const response = await fetch(tokenUrl, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.HIE_CLIENT_ID,
      client_secret: env.HIE_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("HIE authentication failed");
  const data = await response.json() as { access_token?: unknown; expires_in?: unknown };
  if (typeof data.access_token !== "string") throw new Error("HIE authentication response invalid");
  const expiresIn = Math.max(60, Math.min(typeof data.expires_in === "number" ? data.expires_in : 300, 3_600));
  const cachedToken = { token: data.access_token, expiresAt: Date.now() + expiresIn * 1_000 };
  tokenCache = cachedToken;
  if (env.HIE_TOKEN_CACHE) await env.HIE_TOKEN_CACHE.put("hie-access-token", JSON.stringify(cachedToken), { expirationTtl: expiresIn });
  return data.access_token;
}

function safePath(requestUrl: URL): { segments: string[]; query: URLSearchParams } | null {
  if (!requestUrl.pathname.startsWith("/fhir/")) return null;
  const rawPath = requestUrl.pathname.slice("/fhir/".length);
  if (!rawPath || rawPath.includes("\\") || rawPath.includes("\0") || rawPath.includes("..")) return null;
  let decoded: string[];
  try {
    decoded = rawPath.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
  if (decoded.length < 1 || decoded.length > 3) return null;
  if (!RESOURCE_TYPES.has(decoded[0])) return null;
  if (decoded.length >= 2 && decoded[1] !== "_search" && !ID_PATTERN.test(decoded[1])) return null;
  if (decoded.length === 3) {
    if (decoded[1] === "_search") return null;
    if (!ID_PATTERN.test(decoded[2])) return null;
  }
  const query = new URLSearchParams();
  for (const [key, value] of requestUrl.searchParams) {
    if (!QUERY_KEYS.has(key) || value.length > 512) return null;
    query.set(key, value);
  }
  return { segments: decoded, query };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function responseHeaders(contentType: string, requestId: string, origin: string | null): Headers {
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": requestId,
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return headers;
}

async function rateLimit(request: Request, env: Env, scope: string): Promise<boolean> {
  if (!env.RATE_LIMITER) return true;
  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return (await env.RATE_LIMITER.limit({ key: `${scope}:${ip}` })).success;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (!validOrigin(request, env)) return json({ error: "origin not allowed" }, 403, cors);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const requestId = crypto.randomUUID();
    const origin = request.headers.get("Origin");
    const allowedOrigin = origin && cors.has("Access-Control-Allow-Origin") ? origin : null;
    try {
      if (!(await rateLimit(request, env, "fhir"))) return json({ error: "rate limit exceeded" }, 429, cors);
      if (!(await authorized(request, env))) return json({ error: "authentication required" }, 401, cors);
      const incomingUrl = new URL(request.url);
      const safe = safePath(incomingUrl);
      if (!safe) return json({ error: "invalid FHIR path" }, 400, cors);
      const mutating = ["POST", "PUT", "PATCH"].includes(request.method);
      if (mutating && !IDEMPOTENCY_PATTERN.test(request.headers.get("Idempotency-Key") ?? "")) return json({ error: "idempotency key required" }, 400, cors);
      if (!["GET", "HEAD", "POST", "PUT", "PATCH"].includes(request.method)) return json({ error: "method not allowed" }, 405, cors);
      if (request.method === "GET" || request.method === "HEAD") {
        if (safe.segments[1] === "_search" && safe.segments.length !== 2) return json({ error: "invalid FHIR path" }, 400, cors);
      }
      if (mutating) {
        const length = Number(request.headers.get("Content-Length") ?? 0);
        if (length > MAX_BODY_BYTES) return json({ error: "request too large" }, 413, cors);
        const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
        if (contentType !== "application/fhir+json" && contentType !== "application/json") return json({ error: "FHIR JSON required" }, 415, cors);
      }
      const base = upstreamBase(env);
      const target = new URL(base.toString());
      const basePath = base.pathname.replace(/\/$/, "");
      target.pathname = `${basePath}/${safe.segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
      target.search = safe.query.toString();
      const token = await hieToken(env, base);
      const body = mutating ? await request.text() : undefined;
      if (body && new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) return json({ error: "request too large" }, 413, cors);
      const cacheKey = mutating && env.HIE_REQUEST_CACHE && request.headers.get("Idempotency-Key")
        ? `hie-mutation:${await sha256(`${request.method}:${target.toString()}:${request.headers.get("Idempotency-Key")}:${body ?? ""}`)}`
        : null;
      if (cacheKey) {
        const cached = await env.HIE_REQUEST_CACHE!.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { status?: number; body?: string; contentType?: string };
          return new Response(parsed.body ?? "", {
            status: parsed.status ?? 200,
            headers: responseHeaders(parsed.contentType ?? "application/fhir+json", requestId, allowedOrigin),
          });
        }
      }
      const upstreamHeaders = new Headers({
        Authorization: `Bearer ${token}`,
        Accept: "application/fhir+json",
        "Content-Type": "application/fhir+json",
      });
      for (const header of ["if-match", "if-none-match"]) {
        const value = request.headers.get(header);
        if (value) upstreamHeaders.set(header, value);
      }
      if (mutating) upstreamHeaders.set("x-idempotency-key", request.headers.get("Idempotency-Key")!);
      const upstream = await fetch(target, {
        method: request.method,
        headers: upstreamHeaders,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
      if (upstream.status >= 300 && upstream.status < 400) return json({ error: "upstream redirect rejected" }, 502, cors);
      const upstreamText = await upstream.text();
      if (new TextEncoder().encode(upstreamText).byteLength > 5 * 1_048_576) return json({ error: "upstream response too large" }, 502, cors);
      const contentType = upstream.headers.get("Content-Type") ?? "application/fhir+json";
      if (cacheKey && upstream.ok) await env.HIE_REQUEST_CACHE!.put(cacheKey, JSON.stringify({ status: upstream.status, body: upstreamText, contentType }), { expirationTtl: 86_400 });
      return new Response(upstreamText, {
        status: upstream.status,
        headers: responseHeaders(contentType, requestId, allowedOrigin),
      });
    } catch {
      return json({ error: "FHIR service unavailable" }, 503, cors);
    }
  },
};
