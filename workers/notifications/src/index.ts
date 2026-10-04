interface QueueBinding {
  send(message: SmsJob): Promise<void>;
}

interface QueueMessage {
  id: string;
  body: unknown;
  ack(): void;
  retry(): void;
}

interface QueueBatch {
  messages: QueueMessage[];
}

interface Env {
  AT_API_KEY: string;
  AT_USERNAME: string;
  AT_SENDER_ID: string;
  SMS_QUEUE?: QueueBinding;
  NOTIFICATION_DEDUPE?: KVNamespace;
  NOTIFICATION_ENQUEUE_SECRET?: string;
  NOTIFICATION_API_TOKEN?: string;
  ALLOWED_ORIGIN?: string;
}

type JsonRecord = Record<string, unknown>;
type SmsType = "otp" | "order_dispatched" | "order_delivered" | "refill_reminder" | "prescription_ready";

interface SmsJob {
  to: string;
  message: string;
  type: SmsType;
  idempotencyKey?: string;
}

const TYPES = new Set<SmsType>(["otp", "order_dispatched", "order_delivered", "refill_reminder", "prescription_ready"]);
const inMemorySeen = new Map<string, number>();

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
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Notification-Secret, Idempotency-Key");
  return headers;
}

function validOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return (env.ALLOWED_ORIGIN ?? "https://afyacommerce.co.ke").split(",").map((value) => value.trim()).filter(Boolean).includes(origin);
}

function normalizePhone(value: string): string | null {
  const digits = value.replace(/[\s()-]/g, "");
  const normalized = digits.startsWith("+") ? digits : digits.startsWith("0") ? `+254${digits.slice(1)}` : digits.startsWith("254") ? `+${digits}` : `+254${digits}`;
  return /^\+254[17]\d{8}$/.test(normalized) ? normalized : null;
}

function validateJob(value: unknown): SmsJob | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const job = value as JsonRecord;
  if (typeof job.to !== "string" || typeof job.message !== "string" || typeof job.type !== "string") return null;
  if (!TYPES.has(job.type as SmsType)) return null;
  const to = normalizePhone(job.to);
  const message = job.message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!to || message.length < 1 || message.length > 1_600) return null;
  const idempotencyKey = typeof job.idempotencyKey === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(job.idempotencyKey) ? job.idempotencyKey : undefined;
  return { to, message, type: job.type as SmsType, idempotencyKey };
}

async function readBody(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 16_384) throw new Error("request too large");
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("JSON required");
  return request.json();
}

function bearer(request: Request): string | null {
  const value = request.headers.get("Authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

function enqueueAuthorized(request: Request, env: Env): boolean {
  const secret = request.headers.get("X-Notification-Secret") ?? "";
  if (env.NOTIFICATION_ENQUEUE_SECRET && secret === env.NOTIFICATION_ENQUEUE_SECRET) return true;
  const token = bearer(request);
  return Boolean(env.NOTIFICATION_API_TOKEN && token === env.NOTIFICATION_API_TOKEN);
}

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sendSms(job: SmsJob, env: Env): Promise<boolean> {
  const params = new URLSearchParams({
    username: env.AT_USERNAME,
    to: job.to,
    message: job.message,
    from: env.AT_SENDER_ID,
  });
  const response = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey: env.AT_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return false;
  const text = await response.text();
  if (!text) return true;
  try {
    const data = JSON.parse(text) as { status?: unknown; SMSWebResponse?: { Recipients?: Array<{ statuscode?: unknown }> } };
    if (data.status !== undefined && Number(data.status) !== 0) return false;
    const recipients = data.SMSWebResponse?.Recipients ?? [];
    return recipients.every((recipient) => recipient.statuscode === undefined || Number(recipient.statuscode) === 0);
  } catch {
    return true;
  }
}

async function processMessage(message: QueueMessage, env: Env): Promise<void> {
  const job = validateJob(message.body);
  if (!job) {
    message.ack();
    return;
  }
  const key = job.idempotencyKey ?? message.id ?? `job-${await digest(JSON.stringify(job))}`;
  const dedupeKey = `sms:${key}`;
  if (env.NOTIFICATION_DEDUPE) {
    const existing = await env.NOTIFICATION_DEDUPE.get(dedupeKey);
    if (existing) {
      message.ack();
      return;
    }
    await env.NOTIFICATION_DEDUPE.put(dedupeKey, "processing", { expirationTtl: 86_400 });
  } else {
    const previous = inMemorySeen.get(dedupeKey);
    if (previous && previous > Date.now()) {
      message.ack();
      return;
    }
    inMemorySeen.set(dedupeKey, Date.now() + 86_400_000);
  }
  try {
    const sent = await sendSms(job, env);
    if (!sent) {
      if (env.NOTIFICATION_DEDUPE) await env.NOTIFICATION_DEDUPE.delete(dedupeKey);
      else inMemorySeen.delete(dedupeKey);
      message.retry();
      return;
    }
    message.ack();
  } catch {
    if (env.NOTIFICATION_DEDUPE) await env.NOTIFICATION_DEDUPE.delete(dedupeKey);
    else inMemorySeen.delete(dedupeKey);
    message.retry();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(request, env);
    if (!validOrigin(request, env)) return json({ error: "origin not allowed" }, 403, headers);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405, headers);
    if (!enqueueAuthorized(request, env)) return json({ error: "authentication required" }, 401, headers);
    let value: unknown;
    try {
      value = await readBody(request);
    } catch {
      return json({ error: "invalid request" }, 400, headers);
    }
    const job = validateJob(value);
    if (!job) return json({ error: "invalid notification" }, 400, headers);
    if (!env.SMS_QUEUE) return json({ error: "notification queue unavailable" }, 503, headers);
    const suppliedKey = request.headers.get("Idempotency-Key");
    if (suppliedKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(suppliedKey)) return json({ error: "invalid idempotency key" }, 400, headers);
    await env.SMS_QUEUE.send({ ...job, idempotencyKey: suppliedKey ?? job.idempotencyKey });
    return json({ accepted: true }, 202, headers);
  },

  async queue(batch: QueueBatch, env: Env): Promise<void> {
    for (const message of batch.messages) await processMessage(message, env);
  },
};
