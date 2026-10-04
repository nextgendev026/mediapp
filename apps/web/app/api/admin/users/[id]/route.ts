import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { mutate, type UserRole } from '@/lib/server/store';
import { getUserDetail, toPublicUser } from '@/lib/server/queries';
import { recordAudit } from '@/lib/server/audit';
import { enumOf, isSameOriginMutation, str } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['admin']);
  if ('error' in guard) return guard.error;
  const detail = await getUserDetail(params.id);
  if (!detail) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  return NextResponse.json({ user: detail });
}

const ROLES: readonly UserRole[] = ['patient', 'provider', 'pharmacist', 'admin', 'rider'];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['admin']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const role = body.role === undefined ? undefined : enumOf(body.role, ROLES);
  const status = body.status === undefined ? undefined : enumOf(body.status, ['active', 'suspended'] as const);
  if (body.role !== undefined && !role) return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  if (body.status !== undefined && !status) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  if (!role && !status) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  if (params.id === guard.caller.userId) {
    if (status === 'suspended') return NextResponse.json({ error: 'You cannot suspend your own account.' }, { status: 400 });
    if (role && role !== 'admin') return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 400 });
  }

  const reason = str(body.reason, 200).trim();
  const updated = await mutate((db) => {
    const user = db.users.find((u) => u.id === params.id);
    if (!user) return null;
    if (role) user.role = role;
    if (status) user.status = status;
    return user;
  });
  if (!updated) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  if (role) {
    await recordAudit({
      actorId: guard.caller.userId, actorRole: guard.caller.role, action: 'user_role_change',
      resourceType: 'user', resourceId: updated.id, purpose: reason || 'Access management', phiAccessed: false,
      metadata: { role }
    });
  }
  if (status) {
    await recordAudit({
      actorId: guard.caller.userId, actorRole: guard.caller.role, action: status === 'suspended' ? 'user_suspend' : 'user_activate',
      resourceType: 'user', resourceId: updated.id, purpose: reason || 'Access management', phiAccessed: false
    });
  }
  return NextResponse.json({ user: toPublicUser(updated) });
}
