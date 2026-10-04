import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { adminMetrics, computeDormantUserIds } from '@/lib/server/queries';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireRole(['admin']);
  if ('error' in guard) return guard.error;
  const [metrics, dormant] = await Promise.all([adminMetrics(), computeDormantUserIds()]);
  return NextResponse.json({ metrics, dormant });
}
