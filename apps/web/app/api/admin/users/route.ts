import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate, newId, type UserRole } from '@/lib/server/store';
import { listUsers, toPublicUser } from '@/lib/server/queries';
import { recordAudit } from '@/lib/server/audit';
import { hashPassword } from '@/lib/server/password';
import { enumOf, isSameOriginMutation, str } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const guard = await requireRole(['admin']);
  if ('error' in guard) return guard.error;
  const url = new URL(request.url);
  const result = await listUsers({
    q: url.searchParams.get('q') ?? '',
    role: enumOf(url.searchParams.get('role'), ['patient', 'provider', 'pharmacist', 'admin', 'rider'] as const) ?? '',
    status: enumOf(url.searchParams.get('status'), ['active', 'suspended'] as const) ?? '',
    page: Number(url.searchParams.get('page') ?? '1') || 1
  });
  return NextResponse.json(result);
}

const ROLES: readonly UserRole[] = ['patient', 'provider', 'pharmacist', 'admin', 'rider'];

export async function POST(request: Request) {
  const guard = await requireRole(['admin']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const fullName = str(body.fullName, 120).trim();
  const email = str(body.email, 160).trim().toLowerCase();
  const phone = str(body.phone, 24).trim();
  const role = enumOf(body.role, ROLES);
  const password = str(body.password, 200);
  const county = str(body.county, 60) || undefined;
  const specialty = str(body.specialty, 80) || undefined;

  if (fullName.length < 2) return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  if (!role) return NextResponse.json({ error: 'A valid role is required.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });

  const existing = await getDb();
  if (existing.users.some((u) => u.email.toLowerCase() === email)) {
    return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const created = await mutate((db) => {
    if (db.users.some((u) => u.email.toLowerCase() === email)) return null;
    const user = {
      id: newId(), email, passwordHash, fullName, role, phone: phone || '+254000000000',
      status: 'active' as const, mfa: false, createdAt: new Date().toISOString(), county, specialty
    };
    db.users.push(user);
    return user;
  });
  if (!created) return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });

  await recordAudit({
    actorId: guard.caller.userId, actorRole: guard.caller.role, action: 'user_create',
    resourceType: 'user', resourceId: created.id, purpose: 'User provisioning', phiAccessed: false
  });
  return NextResponse.json({ user: toPublicUser(created) }, { status: 201 });
}
