import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate } from '@/lib/server/store';
import { recordAudit } from '@/lib/server/audit';
import { notify } from '@/lib/server/notify';
import { enumOf, isSameOriginMutation } from '@/lib/server/security';
import { VisitStage, stageOf } from '@/lib/workflow';
import { moveVisit } from '@/lib/server/visits';

export const runtime = 'nodejs';

const STATUSES = ['booked', 'completed', 'cancelled', 'no_show'] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['patient', 'provider', 'admin']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const status = enumOf(body.status, STATUSES);
  if (!status) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });

  const db = await getDb();
  const appointment = db.appointments.find((a) => a.id === params.id);
  if (!appointment) return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });

  const isOwner = appointment.patientId === guard.caller.userId;
  const isProvider = appointment.providerId === guard.caller.userId;
  if (guard.caller.role === 'patient' && (!isOwner || status === 'completed')) {
    return NextResponse.json({ error: 'Not permitted.' }, { status: 403 });
  }
  if (guard.caller.role === 'provider' && !isProvider) {
    return NextResponse.json({ error: 'Not permitted.' }, { status: 403 });
  }

  await mutate((db2) => {
    const row = db2.appointments.find((a) => a.id === params.id);
    if (row) row.status = status;
  });

  let stage = stageOf(appointment);
  if (status === 'completed' && stageOf(appointment) === VisitStage.Checkout) {
    stage = (await moveVisit(params.id, VisitStage.Complete)) ?? stageOf(appointment);
  }

  const counterpart = isProvider ? appointment.patientId : appointment.providerId;
  await notify({
    userId: counterpart,
    title: `Appointment ${status.replace('_', ' ')}`,
    body: `Your appointment on ${appointment.date} at ${appointment.time} was marked ${status}.`,
    type: 'appointment',
    href: guard.caller.role === 'patient' ? '/provider/appointments' : '/dashboard'
  });
  await recordAudit({
    actorId: guard.caller.userId, actorRole: guard.caller.role, action: 'appointment_status',
    resourceType: 'appointment', resourceId: params.id, purpose: 'Care coordination', phiAccessed: true,
    metadata: { status, stage }
  });

  return NextResponse.json({ ok: true, status, stage });
}
