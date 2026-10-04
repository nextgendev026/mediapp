import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth/session';
import { getDb, type UserRole, type Visit } from './store';
import { canActInStage, canEnterStage, stageOf, type VisitActorRole } from '../workflow';

export interface Caller {
  userId: string;
  role: UserRole;
  name: string;
}

export type GuardResult = { caller: Caller } | { error: NextResponse };

export async function requireRole(roles?: readonly UserRole[]): Promise<GuardResult> {
  const token = cookies().get('afya_session')?.value;
  const session = await verifySession(token);
  if (!session) {
    return { error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }
  const db = await getDb();
  const user = db.users.find((u) => u.id === session.sub);
  if (!user || user.status !== 'active') {
    return { error: NextResponse.json({ error: 'Account is not active.' }, { status: 403 }) };
  }
  if (roles && !roles.includes(user.role)) {
    return { error: NextResponse.json({ error: 'You do not have permission to perform this action.' }, { status: 403 }) };
  }
  return { caller: { userId: user.id, role: user.role, name: user.fullName } };
}

export function isVisitActorRole(role: UserRole): role is VisitActorRole {
  return role === 'admin' || role === 'provider' || role === 'pharmacist';
}

export interface VisitGuardResult {
  caller: Caller;
  visit: Visit;
}

export type VisitGuardOutcome = VisitGuardResult | { error: NextResponse };

/**
 * Guards writes against a single visit. Admins act anywhere, a clinician acts on visits
 * booked to them or assigned to them, and pharmacists only act while a visit sits in a
 * stage they own (prescription and checkout).
 */
export async function requireVisitAccess(
  visitId: string,
  options: { roles?: readonly VisitActorRole[]; targetStage?: Parameters<typeof canEnterStage>[1]; requireAssignment?: boolean } = {}
): Promise<VisitGuardOutcome> {
  const guard = await requireRole();
  if ('error' in guard) return guard;
  const caller = guard.caller;
  if (!isVisitActorRole(caller.role)) {
    return { error: NextResponse.json({ error: 'You do not have permission to perform this action.' }, { status: 403 }) };
  }
  if (options.roles && !options.roles.includes(caller.role)) {
    return { error: NextResponse.json({ error: 'You do not have permission to perform this action.' }, { status: 403 }) };
  }

  const db = await getDb();
  const visit = db.appointments.find((a) => a.id === visitId);
  if (!visit) return { error: NextResponse.json({ error: 'Visit not found.' }, { status: 404 }) };

  if (options.targetStage && !canEnterStage(caller.role, options.targetStage)) {
    return {
      error: NextResponse.json(
        { error: 'Your role cannot move a visit into that stage.' },
        { status: 403 }
      )
    };
  }

  if (caller.role === 'admin') return { caller, visit };

  if (caller.role === 'provider') {
    const mine = visit.assignedProviderId === caller.userId || visit.providerId === caller.userId;
    const claimable = !visit.assignedProviderId && options.requireAssignment !== true;
    if (!mine && !claimable) {
      return {
        error: NextResponse.json({ error: 'This visit is assigned to another clinician.' }, { status: 403 })
      };
    }
    return { caller, visit };
  }

  const stage = stageOf(visit);
  if (!canActInStage(caller.role, stage)) {
    return {
      error: NextResponse.json(
        { error: `A pharmacist can only act while the visit is at prescription or checkout (current stage: ${stage}).` },
        { status: 403 }
      )
    };
  }
  return { caller, visit };
}
