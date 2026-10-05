import 'server-only';

const STATE_KEY = 'app-db';

export function isCloudflareRuntime(): boolean {
  return (
    process.env.AFYA_CLOUDFLARE_PAGES === '1' ||
    process.env.CLOUDFLARE === '1'
  );
}

function credentials(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

function authHeaders(key: string): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
}

export async function loadRemoteState<T>(): Promise<T | null> {
  const creds = credentials();
  if (!creds) return null;
  try {
    const res = await fetch(
      `${creds.url}/rest/v1/pages_state?select=data&id=eq.${encodeURIComponent(STATE_KEY)}`,
      { headers: authHeaders(creds.key), cache: 'no-store' }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { data: T }[];
    const first = rows?.[0];
    return first?.data ?? null;
  } catch {
    return null;
  }
}

export async function saveRemoteState<T>(value: T): Promise<boolean> {
  const creds = credentials();
  if (!creds) return false;
  try {
    const res = await fetch(`${creds.url}/rest/v1/pages_state`, {
      method: 'POST',
      headers: { ...authHeaders(creds.key), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: STATE_KEY, data: value })
    });
    return res.ok;
  } catch {
    return false;
  }
}
