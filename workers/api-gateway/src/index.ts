interface ServiceBinding {
  fetch(request: Request): Promise<Response>;
}

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  MPESA?: ServiceBinding;
  FHIR?: ServiceBinding;
  NOTIFICATIONS?: ServiceBinding;
  AI_TRIAGE?: ServiceBinding;
  DISPATCH?: ServiceBinding;
  UPSTREAM_BASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  GATEWAY_INTERNAL_SECRET?: string;
  GATEWAY_UPSTREAM_SECRET?: string;
  ALLOWED_ORIGIN?: string;
  RATE_LIMITER?: RateLimiter;
  RATE_LIMIT_KV?: KVNamespace;
}

type JsonRecord = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_BODY_BYTES = 1_048_576;

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
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Idempotency-Key, If-Match, If-None-Match, X-Request-Id");
  return headers;
}

function validOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return (env.ALLOWED_ORIGIN ?? "https://afyacommerce.co.ke").split(",").map((value) => value.trim()).filter(Boolean).includes(origin);
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

function requestId(): string {
  return crypto.randomUUID();
}

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function internalAuthorized(request: Request, env: Env): boolean {
  const secret = request.headers.get("X-Gateway-Internal-Secret") ?? "";
  return Boolean(env.GATEWAY_INTERNAL_SECRET && equalSecret(secret, env.GATEWAY_INTERNAL_SECRET));
}

async function authenticatedUser(request: Request, env: Env): Promise<{ id: string; role: string } | null> {
  const token = bearer(request);
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const base = new URL(env.SUPABASE_URL);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) return null;
  const response = await fetch(`${base.toString().replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: unknown };
  if (typeof user.id !== "string" || !UUID_PATTERN.test(user.id)) return null;
  const profilesResponse = await fetch(`${base.toString().replace(/\/$/, "")}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!profilesResponse.ok) return { id: user.id, role: "patient" };
  const profiles = await profilesResponse.json() as unknown;
  const role = Array.isArray(profiles) && profiles[0] && typeof profiles[0] === "object" ? String((profiles[0] as JsonRecord).role ?? "patient") : "patient";
  return { id: user.id, role };
}

function routeFor(pathname: string): { binding: "MPESA" | "FHIR" | "NOTIFICATIONS" | "AI_TRIAGE" | "DISPATCH"; prefix: string } | null {
  if (pathname === "/api/mpesa" || pathname.startsWith("/api/mpesa/")) return { binding: "MPESA", prefix: "/api/mpesa" };
  if (pathname === "/fhir" || pathname.startsWith("/fhir/")) return { binding: "FHIR", prefix: "/fhir" };
  if (pathname === "/api/notifications" || pathname.startsWith("/api/notifications/")) return { binding: "NOTIFICATIONS", prefix: "/api/notifications" };
  if (pathname === "/api/ai-triage" || pathname === "/api/triage" || pathname.startsWith("/api/ai-triage/")) return { binding: "AI_TRIAGE", prefix: "/api/ai-triage" };
  if (pathname === "/dispatch" || pathname.startsWith("/dispatch/")) return { binding: "DISPATCH", prefix: "/dispatch" };
  return null;
}

function mutatingRequest(pathname: string, method: string): boolean {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;
  return pathname !== "/api/mpesa/callback";
}

const DISPATCH_ROLES_BY_METHOD: Record<string, string[]> = {
  "rider:GET": ["rider", "admin"],
};

function dispatchRoleAllowed(pathname: string, method: string, role: string): boolean {
  if (method === "POST" && /\/dispatch(?:\/orders)?$/.test(pathname)) return role === "admin" || role === "pharmacist";
  if (method === "POST" && /\/dispatch\/availability$/.test(pathname)) return role === "rider";
  if (method === "GET" && /\/dispatch\/orders$/.test(pathname)) return (DISPATCH_ROLES_BY_METHOD[`${role}:GET`] ?? []).includes(role);
  if (method === "POST" && /\/dispatch\/orders\/[0-9a-f-]+\/accept$/.test(pathname)) return role === "rider";
  if (method === "POST" && /\/dispatch\/orders\/[0-9a-f-]+\/proof$/.test(pathname)) return role === "rider";
  if (method === "POST" && /\/dispatch\/orders\/[0-9a-f-]+\/proof\/photo$/.test(pathname)) return role === "rider";
  if (method === "GET" && /\/dispatch\/orders\/[0-9a-f-]+$/.test(pathname)) return true;
  return false;
}

async function rateLimit(request: Request, env: Env, pathname: string): Promise<boolean> {
  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const scope = pathname.startsWith("/api/ai-triage") || pathname.startsWith("/api/mpesa") ? "sensitive" : "general";
  if (env.RATE_LIMITER) return (await env.RATE_LIMITER.limit({ key: `${scope}:${await digest(ip)}` })).success;
  if (env.RATE_LIMIT_KV) {
    const bucket = Math.floor(Date.now() / 60_000);
    const key = `gateway:${scope}:${await digest(ip)}:${bucket}`;
    const current = Number(await env.RATE_LIMIT_KV.get(key) ?? 0);
    const limit = scope === "sensitive" ? 10 : 60;
    if (!Number.isFinite(current) || current >= limit) return false;
    await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 120 });
    return true;
  }
  return true;
}

async function signUpstream(headers: Headers, env: Env, method: string, pathname: string, id: string): Promise<Headers> {
  if (!env.GATEWAY_UPSTREAM_SECRET) return headers;
  const timestamp = Date.now().toString();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.GATEWAY_UPSTREAM_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const payload = `${id}:${timestamp}:${method}:${pathname}`;
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature)));
  headers.set("X-Afya-Request-Id", id);
  headers.set("X-Afya-Timestamp", timestamp);
  headers.set("X-Afya-Signature", encoded);
  return headers;
}

function filteredHeaders(request: Request, id: string): Headers {
  const headers = new Headers();
  const allowed = ["authorization", "content-type", "accept", "idempotency-key", "if-match", "if-none-match", "x-request-id"];
  for (const name of allowed) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("X-Request-Id", id);
  headers.delete("cookie");
  return headers;
}

async function forward(request: Request, env: Env, route: { binding: "MPESA" | "FHIR" | "NOTIFICATIONS" | "AI_TRIAGE" | "DISPATCH"; prefix: string }, id: string): Promise<Response> {
  const headers = filteredHeaders(request, id);
  const service = env[route.binding];
  const source = new URL(request.url);
  let upstreamRequest: Request;
  if (service) {
    await signUpstream(headers, env, request.method, source.pathname, id);
    upstreamRequest = new Request(request, { headers });
  } else {
    if (!env.UPSTREAM_BASE_URL) throw new Error("upstream unavailable");
    const base = new URL(env.UPSTREAM_BASE_URL);
    if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) throw new Error("invalid upstream URL");
    const target = new URL(`${base.toString().replace(/\/$/, "")}${source.pathname}${source.search}`);
    await signUpstream(headers, env, request.method, target.pathname, id);
    upstreamRequest = new Request(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });
  }
  const response = service ? await service.fetch(upstreamRequest) : await fetch(upstreamRequest);
  const responseHeaders = new Headers();
  const contentType = response.headers.get("Content-Type") ?? "application/octet-stream";
  responseHeaders.set("Content-Type", contentType);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Request-Id", id);
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  const origin = request.headers.get("Origin");
  const allowedOrigin = origin && (env.ALLOWED_ORIGIN ?? "https://afyacommerce.co.ke").split(",").map((value) => value.trim()).includes(origin) ? origin : null;
  if (allowedOrigin) {
    responseHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
    responseHeaders.set("Vary", "Origin");
  }
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

async function handle(request: Request, env: Env): Promise<Response> {
  const headers = corsHeaders(request, env);
  if (!validOrigin(request, env)) return json({ error: "origin not allowed" }, 403, headers);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const url = new URL(request.url);
  if (url.pathname === "/healthz" && request.method === "GET") return json({ status: "ok" }, 200, headers);
  const route = routeFor(url.pathname);
  if (!route) return json({ error: "not found" }, 404, headers);
  const internal = internalAuthorized(request, env);
  if (route.binding === "NOTIFICATIONS" && !internal) return json({ error: "authentication required" }, 401, headers);
  if (!internal) {
    const user = await authenticatedUser(request, env);
    if (!user) return json({ error: "authentication required" }, 401, headers);
    if (route.binding === "DISPATCH" && !dispatchRoleAllowed(url.pathname, request.method, user.role)) {
      return json({ error: "permission denied" }, 403, headers);
    }
  }
  if (mutatingRequest(url.pathname, request.method) && !IDEMPOTENCY_PATTERN.test(request.headers.get("Idempotency-Key") ?? "")) {
    return json({ error: "idempotency key required" }, 400, headers);
  }
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > MAX_BODY_BYTES) return json({ error: "request too large" }, 413, headers);
  if (!(await rateLimit(request, env, url.pathname))) return json({ error: "rate limit exceeded" }, 429, headers);
  const id = requestId();
  try {
    return await forward(request, env, route, id);
  } catch {
    return json({ error: "upstream service unavailable" }, 503, corsHeaders(request, env));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
};
