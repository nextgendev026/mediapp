import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_TIMEOUT_MS = 12_000;

export interface AuthenticatedCaller {
  userId: string;
  accessToken: string;
  profile: { role: string; full_name: string | null; phone: string | null };
}

export function backendBaseUrl(): string | null {
  const value = process.env.INTERNAL_API_BASE_URL ?? process.env.MPESA_API_BASE_URL ?? '';
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      return null;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function backendUnavailable(): NextResponse {
  return NextResponse.json(
    { error: 'Payments are temporarily unavailable. Please try again shortly.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function requireCaller(): Promise<AuthenticatedCaller | NextResponse> {
  const supabase = createClient();
  if (!supabase) return backendUnavailable();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? '';
  if (sessionError || !accessToken) {
    return NextResponse.json({ error: 'Sign in to continue' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return NextResponse.json({ error: 'Sign in to continue' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const { data: rows, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name, phone, is_active')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError || !rows || rows.is_active !== true) {
    return NextResponse.json({ error: 'Account is not active' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  return {
    userId: data.user.id,
    accessToken,
    profile: { role: rows.role, full_name: rows.full_name, phone: rows.phone }
  };
}

export function isResponse(value: AuthenticatedCaller | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export interface BackendCallOptions {
  path: string;
  method?: 'GET' | 'POST';
  token: string;
  body?: unknown;
  idempotencyKey?: string;
  query?: Record<string, string>;
}

export async function callBackend(options: BackendCallOptions): Promise<Response> {
  const base = backendBaseUrl();
  if (!base) throw new Error('backend unavailable');
  const url = new URL(`${base}${options.path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
  const headers = new Headers({ Accept: 'application/json' });
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
  return fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? null : JSON.stringify(options.body),
    cache: 'no-store',
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  });
}

export function idempotencyKeyFromRequest(request: Request): string | null {
  const supplied = request.headers.get('Idempotency-Key')?.trim() ?? '';
  if (!supplied) return null;
  return /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : null;
}

export function upstreamError(status: number, payload: unknown): NextResponse {
  const message =
    payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : 'Payment could not be completed. Please try again.';
  const safe = /^[A-Za-z0-9 ,.'\-()]{3,160}$/.test(message) ? message : 'Payment could not be completed. Please try again.';
  return NextResponse.json({ error: safe }, { status, headers: { 'Cache-Control': 'no-store' } });
}
