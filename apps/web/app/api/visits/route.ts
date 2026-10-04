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
import { isVisitStage, stageOf, VISIT_STAGES } from '@/lib/workflow';

export const runtime = 'nodejs';

const DEFAULT_PROVIDER_ID = '00000000-0000-4000-8000-000000000002';

interface VisitInvoiceView {
  number: string;
  status: string;
  balance: number;
}

interface VisitView {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  providerId: string;
  providerName: string;
  assignedTo?: string | undefined;
  assignedToName: string;
  date: string;
  time: string;
  mode: string;
  status: string;
  reason: string;
  feeKes: number;
  stage: string;
  openLabs: number;
  invoice: VisitInvoiceView | null;
}

export async function GET(request: Request) {
  const guard = await requireRole(['admin', 'provider']);
  if ('error' in guard) return guard.error;
  const db = await getDb();
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  const today = new Date().toISOString().slice(0, 10);
  const dateFilter = url.searchParams.get('date') ?? (scope === 'today' || (!scope && guard.caller.role === 'provider') ? today : null);
  const stageFilter = url.searchParams.get('stage');
  const patientFilter = url.searchParams.get('patientId');

  let rows = db.appointments.slice();
  if (dateFilter) rows = rows.filter((a) => a.date === dateFilter);
  if (patientFilter) rows = rows.filter((a) => a.patientId === patientFilter);
  if (stageFilter && isVisitStage(stageFilter)) rows = rows.filter((a) => stageOf(a) === stageFilter);
  rows.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));

  const nameOf = (id: string): string => db.users.find((u) => u.id === id)?.fullName ?? 'Unknown';

  const visits: VisitView[] = rows.map((a) => {
    const invoice = a.invoiceId ? db.invoices.find((i) => i.id === a.invoiceId) : undefined;
    const openLabs = db.labOrders.filter(
      (o) =>
        o.status !== 'resulted' &&
        (o.appointmentId === a.id || (!o.appointmentId && o.patientId === a.patientId))
    ).length;
    const view: VisitView = {
      id: a.id,
      patientId: a.patientId,
      patientName: nameOf(a.patientId),
      phone: db.users.find((u) => u.id === a.patientId)?.phone ?? '',
      providerId: a.providerId,
      providerName: nameOf(a.providerId),
      assignedTo: a.assignedTo,
      assignedToName: a.assignedTo ? nameOf(a.assignedTo) : '',
      date: a.date,
      time: a.time,
      mode: a.mode,
      status: a.status,
      reason: a.reason,
      feeKes: a.feeKes,
      stage: stageOf(a),
      openLabs,
      invoice: invoice ? { number: invoice.number, status: invoice.status, balance: invoice.totalKes - invoice.paidKes } : null
    };
    return view;
  });

  const labOrderSummary = {
    total: db.labOrders.length,
    ordered: db.labOrders.filter((o) => o.status === 'ordered').length,
    in_progress: db.labOrders.filter((o) => o.status === 'in_progress').length,
    resulted: db.labOrders.filter((o) => o.status === 'resulted').length
  };

  return NextResponse.json({ visits, stages: VISIT_STAGES, labOrderSummary });
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
    const nowIso = new Date().toISOString();
    const created: UserRecord = {
      id: newId(),
      email: `walkin.${randomBytes(5).toString('hex')}@afyacommerce.test`,
      passwordHash: await hashPassword(randomBytes(32).toString('hex')),
      fullName: patientName,
      role: 'patient',
      phone,
      status: 'active',
      mfa: false,
      createdAt: nowIso,
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
    stage: 'front_desk'
  };

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
    phiAccessed: true
  });

  return NextResponse.json(
    {
      appointment,
      patient: { id: patient.id, fullName: patient.fullName, phone: patient.phone, role: patient.role }
    },
    { status: 201 }
  );
}
