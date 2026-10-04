import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate, type UserRecord } from '@/lib/server/store';
import { recordAudit } from '@/lib/server/audit';
import { notify } from '@/lib/server/notify';
import { enumOf, isSameOriginMutation, str } from '@/lib/server/security';
import { isVisitStage, stageIndex, stageOf, type VisitStage } from '@/lib/workflow';

export const runtime = 'nodejs';

const STATUSES = ['booked', 'completed', 'cancelled', 'no_show'] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['admin', 'provider']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const hasStage = Object.prototype.hasOwnProperty.call(body, 'stage');
  const hasAssignee = Object.prototype.hasOwnProperty.call(body, 'assignedTo');
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status');
  if (!hasStage && !hasAssignee && !hasStatus) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  let stage: VisitStage | null = null;
  if (hasStage) {
    if (!isVisitStage(body.stage)) return NextResponse.json({ error: 'Invalid stage.' }, { status: 400 });
    stage = body.stage;
  }
  const status = hasStatus ? enumOf(body.status, STATUSES) : null;
  if (hasStatus && !status) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  const assigneeId = hasAssignee ? str(body.assignedTo, 64) : '';

  const db = await getDb();
  const appointment = db.appointments.find((a) => a.id === params.id);
  if (!appointment) return NextResponse.json({ error: 'Visit not found.' }, { status: 404 });

  const currentStage = stageOf(appointment);
  const isAdmin = guard.caller.role === 'admin';

  if (stage && !isAdmin) {
    if (stage === 'front_desk') {
      return NextResponse.json({ error: 'Front desk intake is managed by the front desk team.' }, { status: 400 });
    }
    const from = stageIndex(currentStage);
    const to = stageIndex(stage);
    if (to <= from) {
      return NextResponse.json(
        { error: `Visits move forward only (current stage: ${currentStage}). An admin can correct the stage.` },
        { status: 409 }
      );
    }
    if (stage === 'complete') {
      const invoice = appointment.invoiceId ? db.invoices.find((i) => i.id === appointment.invoiceId) : undefined;
      if (invoice && invoice.paidKes < invoice.totalKes) {
        return NextResponse.json(
          { error: `Invoice ${invoice.number} still has a balance of Ksh ${invoice.totalKes - invoice.paidKes}. Collect payment before completing the visit.` },
          { status: 409 }
        );
      }
    }
  }

  let assignee: UserRecord | undefined;
  if (assigneeId) {
    assignee = db.users.find((u) => u.id === assigneeId && u.role === 'provider' && u.status === 'active');
    if (!assignee) return NextResponse.json({ error: 'Assignee must be an active clinician.' }, { status: 400 });
  }

  await mutate((db2) => {
    const row = db2.appointments.find((a) => a.id === params.id);
    if (!row) return;
    if (stage) row.stage = stage;
    if (assignee) row.assignedTo = assignee.id;
    if (status) row.status = status;
  });

  if (assignee) {
    await notify({
      userId: assignee.id,
      title: 'Visit assigned to you',
      body: `${appointment.reason.slice(0, 120)} — ${appointment.date} at ${appointment.time}.`,
      type: 'appointment',
      href: '/provider/queue'
    });
  }
  if (stage && stage !== currentStage && (stage === 'complete' || stage === 'checkout')) {
    await notify({
      userId: appointment.patientId,
      title: stage === 'complete' ? 'Visit complete' : 'Ready for checkout',
      body:
        stage === 'complete'
          ? `Your visit on ${appointment.date} is complete. Thank you for choosing AfyaCommerce.`
          : `Your consultation is finished. Please proceed to checkout for ${appointment.date}.`,
      type: 'appointment',
      href: '/dashboard'
    });
  }
  await recordAudit({
    actorId: guard.caller.userId,
    actorRole: guard.caller.role,
    action: 'visit_stage',
    resourceType: 'appointment',
    resourceId: params.id,
    purpose: 'Care coordination',
    phiAccessed: true,
    metadata: { from: currentStage, to: stage ?? currentStage, ...(assignee ? { assignedTo: assignee.id } : {}) }
  });

  return NextResponse.json({
    ok: true,
    stage: stage ?? currentStage,
    assignedTo: assignee ? assignee.id : (appointment.assignedTo ?? null),
    status: status ?? appointment.status
  });
}
