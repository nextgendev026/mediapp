import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate, type Database } from '@/lib/server/store';
import { recordAudit } from '@/lib/server/audit';
import { notify } from '@/lib/server/notify';
import { enumOf, isSameOriginMutation, str } from '@/lib/server/security';
import { VisitStage } from '@/lib/workflow';
import { moveVisit, nameOf, openLabOrders, visitView, type VisitView } from '@/lib/server/visits';

export const runtime = 'nodejs';

const NEXT_STATUSES = ['in_progress', 'resulted'] as const;

function clinicianOwnsOrder(db: Database, order: { orderedBy: string; appointmentId?: string | undefined }, callerId: string): boolean {
  if (order.orderedBy === callerId) return true;
  if (!order.appointmentId) return false;
  const visit = db.appointments.find((a) => a.id === order.appointmentId);
  if (!visit) return false;
  return visit.providerId === callerId || visit.assignedProviderId === callerId || !visit.assignedProviderId;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['provider', 'admin']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const status = enumOf(body.status, NEXT_STATUSES);
  if (!status) return NextResponse.json({ error: 'Status must be in_progress or resulted.' }, { status: 400 });
  const result = str(body.result ?? '', 4000).trim();
  const interpretation = str(body.interpretation ?? '', 40).trim();

  if (status === 'resulted' && result.length < 3) {
    return NextResponse.json({ error: 'Record the result (at least 3 characters) before marking it resulted.' }, { status: 400 });
  }

  const db = await getDb();
  const order = db.labOrders.find((o) => o.id === params.id);
  if (!order) return NextResponse.json({ error: 'Lab order not found.' }, { status: 404 });
  if (guard.caller.role === 'provider' && !clinicianOwnsOrder(db, order, guard.caller.userId)) {
    return NextResponse.json({ error: 'You are not the clinician responsible for this order.' }, { status: 403 });
  }
  if (order.status === 'resulted' && status === 'resulted') {
    return NextResponse.json({ error: 'This order already has a released result.' }, { status: 409 });
  }

  const updated = await mutate((db2) => {
    const row = db2.labOrders.find((o) => o.id === params.id);
    if (!row) return null;
    row.status = status;
    if (status === 'resulted') {
      row.result = result;
      row.interpretation = interpretation || undefined;
      row.resultedAt = new Date().toISOString();
    }
    return row;
  });
  if (!updated) return NextResponse.json({ error: 'Lab order not found.' }, { status: 404 });

  let visit: VisitView | null = null;
  let visitStage: string | null = null;
  const linked = order.appointmentId ? db.appointments.find((a) => a.id === order.appointmentId) : undefined;
  if (linked) {
    if (status === 'resulted' && openLabOrders(db, linked).length === 0) {
      visitStage = await moveVisit(linked.id, VisitStage.Diagnosis);
    }
    const row = db.appointments.find((a) => a.id === linked.id);
    if (row) visit = visitView(db, row);
  }

  if (status === 'resulted') {
    await notify({
      userId: order.patientId,
      title: 'Lab result ready',
      body: `Your ${order.modality} order (${order.test}) has resulted: ${interpretation || 'see details'}.`,
      type: 'system',
      href: '/dashboard'
    });
    if (order.orderedBy && order.orderedBy !== guard.caller.userId) {
      await notify({
        userId: order.orderedBy,
        title: `${order.test} resulted`,
        body: `${interpretation || 'Result released'} is ready for review.`,
        type: 'system',
        href: order.appointmentId ? `/provider/consultations/${order.appointmentId}` : '/provider/queue'
      });
    }
  }
  await recordAudit({
    actorId: guard.caller.userId,
    actorRole: guard.caller.role,
    action: 'lab_order_update',
    resourceType: 'lab_order',
    resourceId: params.id,
    purpose: 'Diagnostics workflow',
    phiAccessed: true,
    metadata: {
      status,
      ...(visitStage ? { visitStage } : {}),
      ...(linked ? { clinician: nameOf(db, linked.providerId) } : {})
    }
  });

  return NextResponse.json({ ok: true, order: updated, visitStage, visit });
}
