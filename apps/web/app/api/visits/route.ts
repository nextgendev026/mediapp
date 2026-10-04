import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate, newId, type Appointment, type UserRecord } from '@/lib/server/store';
import { recordAudit } from '@/lib/server/audit';
import { notify } from '@/lib/server/notify';
import { isSameOriginMutation, str } from '@/lib/server/security';
import { getSettings } from '@/lib/server/settings';
import { hashPassword } from '@/lib/server/password';
import { isValidKenyanPhone, normalizeKenyanPhone } from '@/lib/utils/validate-phone';
import { VisitStage, VISIT_STAGES, isVisitStage, isVisitStatus } from '@/lib/workflow';
import { MAX_ROOM_ID, MAX_TRIAGE_NOTES, listVisitViews, stageSummary, validateStagePatch } from '@/lib/server/visits';

export const runtime = 'nodejs';

const DEFAULT_PROVIDER_ID = '00000000-0000-4000-8000-000000000002';

export async function GET(request: Request) {
  const guard = await requireRole(['admin', 'provider']);
  if ('error' in guard) return guard.error;
  const db = await getDb();
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  const today = new Date().toISOString().slice(0, 10);
  const dateParam = url.searchParams.get('date');
  const dateFilter = dateParam ?? (scope === 'today' || (!scope && guard.caller.role === 'provider') ? today : null);
  const stageParam = url.searchParams.get('stage');
  if (stageParam && !isVisitStage(stageParam)) {
    return NextResponse.json({ error: 'Invalid stage filter.' }, { status: 400 });
  }
  const statusParam = url.searchParams.get('status');
  if (statusParam && !isVisitStatus(statusParam)) {
    return NextResponse.json({ error: 'Invalid status filter.' }, { status: 400 });
  }

  const visits = await listVisitViews({
    date: dateFilter,
    stage: isVisitStage(stageParam) ? stageParam : null,
    status: isVisitStatus(statusParam) ? statusParam : null,
    patientId: url.searchParams.get('patientId'),
    providerId: guard.caller.role === 'provider' ? guard.caller.userId : url.searchParams.get('providerId'),
    includeClosed: url.searchParams.get('closed') === 'true'
  });

  const labOrderSummary = {
    total: db.labOrders.length,
    ordered: db.labOrders.filter((o) => o.status === 'ordered').length,
    in_progress: db.labOrders.filter((o) => o.status === 'in_progress').length,
    resulted: db.labOrders.filter((o) => o.status === 'resulted').length
  };

  return NextResponse.json({
    visits,
    stages: VISIT_STAGES,
    stageCounts: stageSummary(db),
    labOrderSummary
  });
}

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

  const patientName = str(body.patientName, 120).trim();
  const phoneRaw = str(body.phone, 20).trim();
  const reason = str(body.reason, 400).trim();
  const gender = str(body.gender ?? '', 20).trim();
  const county = str(body.county ?? '', 60).trim();
  const triageNotes = str(body.triageNotes ?? '', MAX_TRIAGE_NOTES).trim();
  const roomId = str(body.roomId ?? '', MAX_ROOM_ID).trim();
  const existingPatientId = str(body.existingPatientId, 64);
  const requestedProviderId = str(body.providerId, 64);

  if (!isValidKenyanPhone(phoneRaw)) {
    return NextResponse.json({ error: 'A valid Kenyan phone number is required, e.g. 0712345678 or +254712345678.' }, { status: 400 });
  }
  if (reason.length < 5) {
    return NextResponse.json({ error: 'Describe the visit reason in at least 5 characters.' }, { status: 400 });
  }
  if (!existingPatientId && patientName.length < 2) {
    return NextResponse.json({ error: 'Patient name is required for a new walk-in.' }, { status: 400 });
  }

  const db = await getDb();
  const phone = normalizeKenyanPhone(phoneRaw);
  let patient = existingPatientId
    ? db.users.find((u) => u.id === existingPatientId && u.role === 'patient')
    : db.users.find((u) => u.role === 'patient' && normalizeKenyanPhone(u.phone) === phone);

  if (existingPatientId && !patient) {
    return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
  }

  if (!patient) {
    const created: UserRecord = {
      id: newId(),
      email: `walkin.${randomBytes(5).toString('hex')}@afyacommerce.test`,
      passwordHash: await hashPassword(randomBytes(32).toString('hex')),
      fullName: patientName,
      role: 'patient',
      phone,
      status: 'active',
      mfa: false,
      createdAt: new Date().toISOString(),
      county: county || undefined,
      gender: gender || undefined
    };
    await mutate((db2) => {
      db2.users.push(created);
    });
    patient = created;
  }

  let providerId = requestedProviderId || DEFAULT_PROVIDER_ID;
  let provider = db.users.find((u) => u.id === providerId && u.role === 'provider' && u.status === 'active');
  if (!provider && requestedProviderId) {
    return NextResponse.json({ error: 'Selected clinician is not available.' }, { status: 400 });
  }
  if (!provider) {
    provider = db.users.find((u) => u.role === 'provider' && u.status === 'active');
    if (!provider) return NextResponse.json({ error: 'No clinician is available to receive the visit.' }, { status: 400 });
    providerId = provider.id;
  }

  const settings = await getSettings();
  const now = new Date();
  const appointment: Appointment = {
    id: newId(),
    patientId: patient.id,
    providerId,
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
    mode: 'in_person',
    status: 'booked',
    reason,
    feeKes: settings.consultationFeeInPerson,
    createdAt: now.toISOString(),
    stage: VisitStage.FrontDesk,
    checkinAt: now.toISOString(),
    assignedProviderId: provider.id,
    triageNotes: triageNotes || undefined,
    roomId: roomId || undefined
  };

  const refusal = validateStagePatch(db, appointment, { userId: guard.caller.userId, role: 'admin' }, {
    triageNotes: appointment.triageNotes,
    roomId: appointment.roomId,
    assignedProviderId: appointment.assignedProviderId
  });
  if (refusal) return NextResponse.json({ error: refusal.error }, { status: refusal.status });

  await mutate((db2) => {
    db2.appointments.push(appointment);
  });

  await notify({
    userId: providerId,
    title: 'Walk-in at front desk',
    body: `${patient.fullName} checked in for: ${reason.slice(0, 120)}`,
    type: 'appointment',
    href: '/admin/workflow'
  });
  await recordAudit({
    actorId: guard.caller.userId,
    actorRole: guard.caller.role,
    action: 'visit_intake',
    resourceType: 'appointment',
    resourceId: appointment.id,
    purpose: 'Front desk intake',
    phiAccessed: true,
    metadata: { stage: VisitStage.FrontDesk, roomId: appointment.roomId ?? 'unassigned' }
  });

  return NextResponse.json(
    {
      visitId: appointment.id,
      appointment,
      patient: { id: patient.id, fullName: patient.fullName, phone: patient.phone, role: patient.role }
    },
    { status: 201 }
  );
}
