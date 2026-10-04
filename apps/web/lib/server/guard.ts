import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth/session';
import { getDb, type UserRole } from './store';

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
