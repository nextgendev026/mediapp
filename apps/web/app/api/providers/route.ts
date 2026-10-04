import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireRole(['patient', 'admin']);
  if ('error' in guard) return guard.error;
  const db = await getDb();
  const providers = db.users
    .filter((u) => u.role === 'provider' && u.status === 'active')
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      specialty: u.specialty ?? 'General practice',
      county: u.county ?? '',
      feeFromKes: 800
    }));
  return NextResponse.json({ providers });
}
