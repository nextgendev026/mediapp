interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface AiBinding {
  run(model: string, input: unknown): Promise<unknown>;
}

interface Env {
  AI: AiBinding;
  AI_RESPONSE_CACHE?: KVNamespace;
  AI_INGRESS_TOKEN?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  ALLOWED_ORIGIN?: string;
  RATE_LIMITER?: RateLimiter;
}

type JsonRecord = Record<string, unknown>;
type Urgency = "EMERGENCY" | "URGENT" | "ROUTINE";

const URGENCIES = new Set<Urgency>(["EMERGENCY", "URGENT", "ROUTINE"]);
const MAX_BODY_BYTES = 24_576;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const SYSTEM_PROMPT = `You are a clinical triage assistant for a Kenyan telehealth platform. Classify urgency as EMERGENCY, URGENT, or ROUTINE. Never diagnose, prescribe, or claim certainty. Identify red flags and recommend a safe next step, including emergency services for urgent danger. Return JSON only with keys urgency, recommended_action, red_flags, and swahili_summary. Do not include identifiers or repeat unnecessary personal details.`;
const EMERGENCY_TERMS = [
  "cannot breathe",
  "difficulty breathing",
  "severe chest pain",
  "chest pain",
  "unconscious",
  "unresponsive",
  "severe bleeding",
  "stroke",
  "face droop",
  "slurred speech",
  "anaphylaxis",
  "seizure",
  "convulsion",
  "suicidal",
  "overdose",
  "poisoning",
];

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
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");
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

async function authorized(request: Request, env: Env): Promise<boolean> {
  const token = bearer(request);
  if (!token) return false;
  if (env.AI_INGRESS_TOKEN && equalSecret(token, env.AI_INGRESS_TOKEN)) return true;
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

async function readBody(request: Request): Promise<JsonRecord> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new Error("request too large");
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("JSON required");
  const value: unknown = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid body");
  return value as JsonRecord;
}

function sanitize(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[contact-redacted]")
    .replace(/(?:\+?254|0)[17]\d{8}/g, "[phone-redacted]")
    .replace(/\b\d{7,16}\b/g, "[number-redacted]")
    .slice(0, 2_000);
}

function emergencyResult(): JsonRecord {
  return {
    urgency: "EMERGENCY",
    recommended_action: "Seek emergency medical care now. Call 119 or 999 and do not wait for an online consultation.",
    red_flags: ["reported emergency red flag"],
    swahili_summary: "Tafadhali pata matibabu ya dharura mara moja. Piga simu 119 au 999.",
  };
}

function containsEmergencyTerm(symptoms: string): boolean {
  const normalized = symptoms.toLowerCase();
  return EMERGENCY_TERMS.some((term) => normalized.includes(term));
}

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as JsonRecord;
  if (typeof record.response === "string") return record.response;
  if (typeof record.text === "string") return record.text;
  if (Array.isArray(record.response) && record.response[0] && typeof record.response[0] === "object") {
    const first = record.response[0] as JsonRecord;
    if (typeof first.response === "string") return first.response;
  }
  return "";
}

function normalizeResult(value: unknown): JsonRecord | null {
  const text = extractText(value).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const result = parsed as JsonRecord;
  const urgency = typeof result.urgency === "string" ? result.urgency.toUpperCase() as Urgency : null;
  if (!urgency || !URGENCIES.has(urgency)) return null;
  if (typeof result.recommended_action !== "string" || result.recommended_action.length < 1 || result.recommended_action.length > 1_000) return null;
  if (!Array.isArray(result.red_flags) || result.red_flags.length > 20 || result.red_flags.some((item) => typeof item !== "string" || item.length > 300)) return null;
  if (typeof result.swahili_summary !== "string" || result.swahili_summary.length > 1_000) return null;
  return {
    urgency,
    recommended_action: sanitize(result.recommended_action),
    red_flags: result.red_flags.map((item) => sanitize(String(item))).slice(0, 20),
    swahili_summary: sanitize(result.swahili_summary),
  };
}

async function rateLimit(request: Request, env: Env): Promise<boolean> {
  if (!env.RATE_LIMITER) return true;
  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return (await env.RATE_LIMITER.limit({ key: `ai:${ip}` })).success;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(request, env);
    if (!validOrigin(request, env)) return json({ error: "origin not allowed" }, 403, headers);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405, headers);
    try {
      if (!(await rateLimit(request, env))) return json({ error: "rate limit exceeded" }, 429, headers);
      if (!(await authorized(request, env))) return json({ error: "authentication required" }, 401, headers);
      const body = await readBody(request);
      const symptoms = typeof body.symptoms === "string" ? sanitize(body.symptoms.trim()) : "";
      const age = Number(body.age);
      const chronic = Array.isArray(body.chronic_conditions)
        ? body.chronic_conditions.filter((item): item is string => typeof item === "string").map(sanitize).slice(0, 20)
        : [];
      if (body.consentToProcess !== true || symptoms.length < 3 || symptoms.length > 2_000 || !Number.isInteger(age) || age < 0 || age > 130) {
        return json({ error: "valid consent and symptoms are required" }, 400, headers);
      }
      if (chronic.length !== (Array.isArray(body.chronic_conditions) ? body.chronic_conditions.length : 0)) return json({ error: "invalid chronic conditions" }, 400, headers);
      const suppliedKey = request.headers.get("Idempotency-Key");
      if (suppliedKey && !IDEMPOTENCY_PATTERN.test(suppliedKey)) return json({ error: "invalid idempotency key" }, 400, headers);
      const requestFingerprint = await digest(JSON.stringify({ symptoms, age, chronic }));
      const key = suppliedKey ?? `triage-${requestFingerprint}`;
      const cacheKey = `ai:${key}:${requestFingerprint}`;
      if (env.AI_RESPONSE_CACHE) {
        const cached = await env.AI_RESPONSE_CACHE.get(cacheKey);
        if (cached) return json(JSON.parse(cached) as JsonRecord, 200, headers);
      }
      if (containsEmergencyTerm(symptoms)) {
        const result = emergencyResult();
        if (env.AI_RESPONSE_CACHE) await env.AI_RESPONSE_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 3_600 });
        return json(result, 200, headers);
      }
      const aiResult = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Age: ${age}\nChronic conditions: ${chronic.join(", ") || "none"}\nSymptoms: ${symptoms}` },
        ],
        max_tokens: 400,
        temperature: 0,
      });
      const result = normalizeResult(aiResult);
      if (!result) return json({ error: "invalid triage response" }, 502, headers);
      if (env.AI_RESPONSE_CACHE) await env.AI_RESPONSE_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 3_600 });
      return json(result, 200, headers);
    } catch {
      return json({ error: "triage service unavailable" }, 503, headers);
    }
  },
};
