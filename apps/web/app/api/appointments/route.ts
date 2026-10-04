import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate, newId, type Appointment } from '@/lib/server/store';
import { recordAudit } from '@/lib/server/audit';
import { createInvoice } from '@/lib/server/billing';
import { notify } from '@/lib/server/notify';
import { enumOf, isSameOriginMutation, str } from '@/lib/server/security';
import { getSettings } from '@/lib/server/settings';

export const runtime = 'nodejs';

const MODES = ['video', 'chat', 'in_person'] as const;

export async function GET(request: Request) {
  const guard = await requireRole(['patient', 'provider', 'pharmacist', 'admin']);
  if ('error' in guard) return guard.error;
  const db = await getDb();
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') ?? (guard.caller.role === 'patient' ? 'mine' : 'all');

  let rows = db.appointments.slice();
  if (scope === 'mine' || guard.caller.role === 'patient') {
    rows = rows.filter((a) => a.patientId === guard.caller.userId || a.providerId === guard.caller.userId);
  } else if (url.searchParams.get('patientId')) {
    const pid = url.searchParams.get('patientId');
    rows = rows.filter((a) => a.patientId === pid);
  }
  rows.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));

  const view = rows.map((a) => ({
    ...a,
    patientName: db.users.find((u) => u.id === a.patientId)?.fullName ?? 'Unknown',
    providerName: db.users.find((u) => u.id === a.providerId)?.fullName ?? 'Unknown'
  }));
  return NextResponse.json({ appointments: view });
}

export async function POST(request: Request) {
  const guard = await requireRole(['patient']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  const settings = await getSettings();
  if (!settings.bookingEnabled) return NextResponse.json({ error: 'Online booking is currently disabled.' }, { status: 409 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const providerId = str(body.providerId, 64);
  const date = str(body.date, 16);
  const time = str(body.time, 8);
  const mode = enumOf(body.mode, MODES);
  const reason = str(body.reason, 400).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'A valid date is required.' }, { status: 400 });
  if (!/^\d{2}:\d{2}$/.test(time)) return NextResponse.json({ error: 'A valid time is required.' }, { status: 400 });
  if (!mode) return NextResponse.json({ error: 'Consultation mode is required.' }, { status: 400 });
  if (reason.length < 5) return NextResponse.json({ error: 'Describe your concern in at least 5 characters.' }, { status: 400 });

  const db = await getDb();
  const provider = db.users.find((u) => u.id === providerId);
  if (!provider || provider.role !== 'provider' || provider.status !== 'active') {
    return NextResponse.json({ error: 'Provider not available.' }, { status: 400 });
  }
  const conflict = db.appointments.some(
    (a) => a.providerId === providerId && a.date === date && a.time === time && a.status === 'booked'
  );
  if (conflict) return NextResponse.json({ error: 'That slot is already booked. Pick another time.' }, { status: 409 });

  const feeKes = mode === 'video' ? settings.consultationFeeVideo : mode === 'chat' ? settings.consultationFeeChat : settings.consultationFeeInPerson;
  const appointment: Appointment = {
    id: newId(),
    patientId: guard.caller.userId,
    providerId,
    date,
    time,
    mode,
    status: 'booked',
    reason,
    feeKes,
    createdAt: new Date().toISOString(),
    stage: 'front_desk',
    assignedProviderId: providerId
  };

  const invoice = await createInvoice({
    patientId: guard.caller.userId,
    sourceType: 'consultation',
    sourceId: appointment.id,
    lines: [{ description: `${mode === 'in_person' ? 'In-person' : mode === 'video' ? 'Video' : 'Chat'} consultation — ${reason.slice(0, 60)}`, qty: 1, unitPriceKes: feeKes }]
  });
  if (invoice) appointment.invoiceId = invoice.id;

  await mutate((db2) => {
    db2.appointments.push(appointment);
  });
  await notify({
    userId: providerId,
    title: 'New booking',
    body: `A patient booked a ${mode.replace('_', ' ')} consultation for ${date} at ${time}.`,
    type: 'appointment',
    href: '/provider/appointments'
  });
  if (invoice) {
    await notify({
      userId: guard.caller.userId,
      title: `Invoice ${invoice.number} issued`,
      body: `Ksh ${invoice.totalKes} for your consultation. Pay before your appointment.`,
      type: 'payment',
      href: `/invoice/${invoice.id}`
    });
  }
  await recordAudit({
    actorId: guard.caller.userId, actorRole: guard.caller.role, action: 'appointment_book',
    resourceType: 'appointment', resourceId: appointment.id, purpose: 'Care access', phiAccessed: true
  });

  return NextResponse.json({ appointment, invoiceId: invoice?.id ?? null }, { status: 201 });
}
