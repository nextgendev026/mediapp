import 'server-only';

const VERSION_KEY = 'session-key-version';

function credentials(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

function headers(key: string): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
}

let cachedVersion: number | null = null;
let cacheExpires = 0;
const CACHE_TTL_MS = 60_000;

export async function getSessionKeyVersion(): Promise<number> {
  const now = Date.now();
  if (cachedVersion !== null && now < cacheExpires) return cachedVersion;
  const creds = credentials();
  if (!creds) {
    cachedVersion = 0;
    cacheExpires = now + CACHE_TTL_MS;
    return 0;
  }
  try {
    const res = await fetch(
      `${creds.url}/rest/v1/pages_state?select=data&id=eq.${encodeURIComponent(VERSION_KEY)}`,
      { headers: headers(creds.key), cache: 'no-store' }
    );
    if (res.ok) {
      const rows = (await res.json()) as { data: { version: number } }[];
      const first = rows?.[0];
      cachedVersion = typeof first?.data?.version === 'number' ? first.data.version : 0;
    } else {
      cachedVersion = 0;
    }
  } catch {
    cachedVersion = 0;
  }
  cacheExpires = now + CACHE_TTL_MS;
  return cachedVersion;
}

export async function rotateSessionKey(): Promise<number> {
  const next = (await getSessionKeyVersion()) + 1;
  const creds = credentials();
  if (creds) {
    try {
      await fetch(`${creds.url}/rest/v1/pages_state`, {
        method: 'POST',
        headers: { ...headers(creds.key), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ id: VERSION_KEY, data: { version: next } })
      });
    } catch {
      // fail-soft
    }
  }
  cachedVersion = next;
  cacheExpires = Date.now() + CACHE_TTL_MS;
  return next;
}

export function baseSecret(): string {
  const value = process.env.AUTH_SESSION_SECRET ?? '';
  if (value.length >= 16) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SESSION_SECRET must be set in production');
  }
  return 'afyacommerce-dev-only-secret-do-not-use-in-production';
}

export async function currentSecret(): Promise<string> {
  const version = await getSessionKeyVersion();
  return version > 0 ? `${baseSecret()}.v${version}` : baseSecret();
}
