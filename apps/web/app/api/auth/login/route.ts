import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/server/store';
import { verifyPassword } from '@/lib/server/password';
import { signSession } from '@/lib/auth/session';
import { clientIp, isSameOriginMutation, rateLimit, str } from '@/lib/server/security';
import { recordAudit } from '@/lib/server/audit';

export const runtime = 'nodejs';

function demoEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return process.env.DEMO_AUTH_ENABLED === 'true';
  return process.env.DEMO_AUTH_ENABLED !== 'false';
}

export async function POST(request: Request) {
  if (!demoEnabled()) {
    return NextResponse.json({ error: 'Password sign-in is disabled.' }, { status: 403 });
  }
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });
  }
  const ip = clientIp(request);
  const limited = rateLimit(`login:${ip}`, 8, 60_000);
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const email = str(body.email, 120).trim().toLowerCase();
  const password = str(body.password, 200);
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const db = await getDb();
  const user = db.users.find((u) => u.email.toLowerCase() === email);
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    await recordAudit({
      actorId: user?.id ?? 'unknown', actorRole: 'anonymous', action: 'auth_login_failed',
      resourceType: 'session', purpose: 'Sign in', phiAccessed: false, ip
    });
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }
  if (user.status !== 'active') {
    await recordAudit({
      actorId: user.id, actorRole: user.role, action: 'auth_login_blocked',
      resourceType: 'session', purpose: 'Sign in', phiAccessed: false, ip
    });
    return NextResponse.json({ error: 'This account is suspended. Contact your administrator.' }, { status: 403 });
  }

  const token = await signSession({ sub: user.id, role: user.role, name: user.fullName });
  user.lastLoginAt = new Date().toISOString();
  await recordAudit({
    actorId: user.id, actorRole: user.role, action: 'auth_login',
    resourceType: 'session', purpose: 'Sign in', phiAccessed: false, ip
  });

  const response = NextResponse.json({ ok: true, role: user.role, name: user.fullName });
  response.cookies.set('afya_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12
  });
  return response;
}
