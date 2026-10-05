import 'server-only';

import { clientIp, str } from '../server/security';

const STATE_KEY = 'app-db';

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

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  type:
    | 'failed_login'
    | 'rate_limit'
    | 'anomaly'
    | 'brute_force'
    | 'block'
    | 'lock'
    | 'auto_mend'
    | 'key_rotation'
    | 'lockdown';
  severity: Severity;
  ip?: string | undefined;
  accountId?: string | undefined;
  detail?: Record<string, unknown> | undefined;
  actionTaken?: string | undefined;
}

export async function recordEvent(event: SecurityEvent): Promise<void> {
  const creds = credentials();
  if (!creds) return;
  try {
    await fetch(`${creds.url}/rest/v1/security_events`, {
      method: 'POST',
      headers: { ...headers(creds.key), Prefer: 'return=minimal' },
      body: JSON.stringify({
        type: event.type,
        severity: event.severity,
        ip: event.ip,
        account_id: event.accountId,
        detail: event.detail ?? {},
        action_taken: event.actionTaken
      })
    });
  } catch {
    // fail-soft: security logging must never break the request path
  }
}

export interface Block {
  target: string;
  kind: 'ip' | 'account';
  reason: string;
  severity: Severity;
  blockedAt: string;
  expiresAt: string | null;
  auto: boolean;
}

export async function activeBlocks(): Promise<Block[]> {
  const creds = credentials();
  if (!creds) return [];
  try {
    const res = await fetch(
      `${creds.url}/rest/v1/security_blocks?active=eq.true&select=target,kind,reason,severity,expires_at,auto`,
      { headers: headers(creds.key), cache: 'no-store' }
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as {
      target: string;
      kind: 'ip' | 'account';
      reason: string;
      severity: Severity;
      blocked_at: string;
      expires_at: string | null;
      auto: boolean;
    }[];
    const now = Date.now();
    return rows
      .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
      .map((r) => ({
        target: r.target,
        kind: r.kind,
        reason: r.reason,
        severity: r.severity,
        blockedAt: r.blocked_at,
        expiresAt: r.expires_at,
        auto: r.auto
      }));
  } catch {
    return [];
  }
}

export async function isBlocked(ip: string, accountId?: string): Promise<Block | null> {
  const blocks = await activeBlocks();
  const ipBlock = blocks.find((b) => b.kind === 'ip' && b.target === ip);
  if (ipBlock) return ipBlock;
  if (accountId) {
    const acctBlock = blocks.find((b) => b.kind === 'account' && b.target === accountId);
    if (acctBlock) return acctBlock;
  }
  return null;
}

export async function blockTarget(
  target: string,
  kind: 'ip' | 'account',
  reason: string,
  severity: Severity,
  ttlMs: number | null
): Promise<void> {
  const creds = credentials();
  if (!creds) return;
  try {
    await fetch(`${creds.url}/rest/v1/security_blocks`, {
      method: 'POST',
      headers: { ...headers(creds.key), Prefer: 'return=minimal' },
      body: JSON.stringify({
        target,
        kind,
        reason,
        severity,
        expires_at: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null,
        auto: true,
        active: true
      })
    });
  } catch {
    // fail-soft
  }
}

export async function unblockTarget(target: string): Promise<void> {
  const creds = credentials();
  if (!creds) return;
  try {
    await fetch(`${creds.url}/rest/v1/security_blocks?target=eq.${encodeURIComponent(target)}`, {
      method: 'PATCH',
      headers: { ...headers(creds.key), Prefer: 'return=minimal' },
      body: JSON.stringify({ active: false })
    });
  } catch {
    // fail-soft
  }
}

export async function recentEvents(limit = 100): Promise<Record<string, unknown>[]> {
  const creds = credentials();
  if (!creds) return [];
  try {
    const res = await fetch(
      `${creds.url}/rest/v1/security_events?order=at.desc&limit=${limit}`,
      { headers: headers(creds.key), cache: 'no-store' }
    );
    if (!res.ok) return [];
    return (await res.json()) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

const SQLI = /(\bunion\b|\bselect\b|\binsert\b|\bdrop\b|\bupdate\b|\bdelete\b|\bor\b\s+1\s*=\s*1|'\s*or\s*'|"\s*or\s*"|;\s*--)/i;
const XSS = /(<script|javascript:|on\w+\s*=|<\s*img[^>]+onerror|<\s*svg[^>]+onload)/i;
const TRAVERSAL = /(\.\.\/|\.\.\\|%2e%2e|%252e%252e|\/etc\/passwd|\/windows\/win\.ini)/i;
const CMDINJ = /(`|\$\(|\|\||;\s*\w+\s)/;

export interface ThreatAssessment {
  score: number;
  reasons: string[];
  blocked: boolean;
}

export function assessRequest(request: Request, path: string): ThreatAssessment {
  const reasons: string[] = [];
  let score = 0;

  const url = `${path}${request.url.includes('?') ? '?' + request.url.split('?')[1] : ''}`;
  const decoded = safeDecode(url);

  if (TRAVERSAL.test(decoded)) {
    reasons.push('path_traversal');
    score += 40;
  }
  if (SQLI.test(decoded)) {
    reasons.push('sql_injection_pattern');
    score += 35;
  }
  if (XSS.test(decoded)) {
    reasons.push('xss_pattern');
    score += 30;
  }
  if (CMDINJ.test(decoded)) {
    reasons.push('command_injection_pattern');
    score += 35;
  }

  const ua = request.headers.get('user-agent') ?? '';
  if (ua.length > 0 && ua.length < 12) {
    reasons.push('suspicious_user_agent');
    score += 10;
  }
  if (/sqlmap|nikto|nmap|masscan|dirbuster|gobuster|burp|zap/i.test(ua)) {
    reasons.push('scanner_user_agent');
    score += 50;
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 5_000_000) {
    reasons.push('oversized_payload');
    score += 20;
  }

  return { score, reasons, blocked: score >= 60 };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function failedLoginKey(ip: string, accountId?: string): string {
  return accountId ? `acct:${accountId}` : `ip:${ip}`;
}

export { clientIp, str };
