import { NextResponse } from 'next/server';
import { clientIp, isSameOriginMutation, rateLimit } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });
  }
  const limited = rateLimit(`logout:${clientIp(request)}`, 20, 60_000);
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set('afya_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  });
  return response;
}
