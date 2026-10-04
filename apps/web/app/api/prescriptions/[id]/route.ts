import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate } from '@/lib/server/store';
import { recordAudit } from '@/lib/server/audit';
import { notify } from '@/lib/server/notify';
import { enumOf, isSameOriginMutation, str } from '@/lib/server/security';

export const runtime = 'nodejs';

const ACTIONS = ['approved', 'rejected', 'dispensed'] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['pharmacist']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const status = enumOf(body.status, ACTIONS);
  if (!status) return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  const notes = str(body.notes ?? '', 400);

  const db = await getDb();
  const rx = db.prescriptions.find((p) => p.id === params.id);
  if (!rx) return NextResponse.json({ error: 'Prescription not found.' }, { status: 404 });
  if (rx.status === 'dispensed' && status !== 'dispensed') {
    return NextResponse.json({ error: 'A dispensed prescription cannot be reverted.' }, { status: 409 });
  }
  if (status === 'dispensed' && rx.status !== 'approved') {
    return NextResponse.json({ error: 'Approve the prescription before dispensing.' }, { status: 409 });
  }

  await mutate((db2) => {
    const row = db2.prescriptions.find((p) => p.id === params.id);
    if (row) {
      row.status = status;
      row.signedBy = guard.caller.userId;
      if (notes) row.notes = notes;
    }
  });

  const drugList = rx.items.map((i) => i.name).join(', ');
  await notify({
    userId: rx.patientId,
    title: `Prescription ${status}`,
    body: `${drugList} was ${status}${notes ? ` — ${notes}` : '.'}`,
    type: 'prescription', href: '/dashboard'
  });
  await recordAudit({
    actorId: guard.caller.userId, actorRole: guard.caller.role, action: `prescription_${status}`,
    resourceType: 'prescription', resourceId: params.id, purpose: 'Pharmacy dispensing', phiAccessed: true
  });
  return NextResponse.json({ ok: true, status });
}
