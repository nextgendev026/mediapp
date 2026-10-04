import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate, newId, nextNumber, type LabOrder } from '@/lib/server/store';
import { recordAudit } from '@/lib/server/audit';
import { notify } from '@/lib/server/notify';
import { enumOf, isSameOriginMutation, str } from '@/lib/server/security';
import { createInvoice } from '@/lib/server/billing';

export const runtime = 'nodejs';

const MODALITIES = ['laboratory', 'imaging'] as const;
const STATUSES = ['ordered', 'in_progress', 'resulted'] as const;
const DEFAULT_PRICE: Record<'laboratory' | 'imaging', number> = { laboratory: 1500, imaging: 3500 };

interface LabOrderView {
  id: string;
  appointmentId?: string | undefined;
  encounterId?: string | undefined;
  patientId: string;
  patientName: string;
  orderedBy: string;
  orderedByName: string;
  modality: string;
  test: string;
  clinicalQuestion: string;
  priceKes: number;
  status: string;
  result?: string | undefined;
  interpretation?: string | undefined;
  createdAt: string;
  resultedAt?: string | undefined;
}

export async function GET(request: Request) {
  const guard = await requireRole(['admin', 'provider']);
  if ('error' in guard) return guard.error;
  const db = await getDb();
  const url = new URL(request.url);
  const patientId = url.searchParams.get('patientId');
  const status = url.searchParams.get('status');
  const appointmentId = url.searchParams.get('appointmentId');

  let rows = db.labOrders.slice();
  if (patientId) rows = rows.filter((o) => o.patientId === patientId);
  if (status) rows = rows.filter((o) => o.status === status);
  if (appointmentId) rows = rows.filter((o) => o.appointmentId === appointmentId);
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const nameOf = (id: string): string => db.users.find((u) => u.id === id)?.fullName ?? 'Unknown';
  const labOrders: LabOrderView[] = rows.map((o) => ({
    id: o.id,
    appointmentId: o.appointmentId,
    encounterId: o.encounterId,
    patientId: o.patientId,
    patientName: nameOf(o.patientId),
    orderedBy: o.orderedBy,
    orderedByName: nameOf(o.orderedBy),
    modality: o.modality,
    test: o.test,
    clinicalQuestion: o.clinicalQuestion,
    priceKes: o.priceKes,
    status: o.status,
    result: o.result,
    interpretation: o.interpretation,
    createdAt: o.createdAt,
    resultedAt: o.resultedAt
  }));

  return NextResponse.json({ labOrders });
}

export async function POST(request: Request) {
  const guard = await requireRole(['provider']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const patientId = str(body.patientId, 64);
  const modality = enumOf(body.modality, MODALITIES);
  const test = str(body.test, 160).trim();
  const clinicalQuestion = str(body.clinicalQuestion ?? '', 400).trim();
  const appointmentId = str(body.appointmentId, 64);
  const encounterId = str(body.encounterId, 64);
  const rawPrice = body.priceKes;

  if (!modality) return NextResponse.json({ error: 'Choose laboratory or imaging.' }, { status: 400 });
  if (test.length < 2) return NextResponse.json({ error: 'Name the test to order.' }, { status: 400 });

  let priceKes = DEFAULT_PRICE[modality];
  if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
    const parsed = typeof rawPrice === 'string' ? Number(rawPrice) : rawPrice;
    if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed < 100 || parsed > 100000) {
      return NextResponse.json({ error: 'Price must be between Ksh 100 and Ksh 100,000.' }, { status: 400 });
    }
    priceKes = Math.round(parsed);
  }

  const db = await getDb();
  const patient = db.users.find((u) => u.id === patientId && u.role === 'patient');
  if (!patient) return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });

  if (appointmentId) {
    const appt = db.appointments.find((a) => a.id === appointmentId);
    if (!appt || appt.patientId !== patientId) return NextResponse.json({ error: 'Appointment mismatch.' }, { status: 400 });
  }
  if (encounterId) {
    const encounter = db.encounters.find((e) => e.id === encounterId);
    if (!encounter || encounter.patientId !== patientId) return NextResponse.json({ error: 'Encounter mismatch.' }, { status: 400 });
  }

  const order = await mutate((db2) => {
    const created: LabOrder = {
      id: nextNumber(db2, 'lab', 'LAB'),
      encounterId: encounterId || undefined,
      appointmentId: appointmentId || undefined,
      patientId,
      orderedBy: guard.caller.userId,
      modality,
      test,
      clinicalQuestion,
      priceKes,
      status: 'ordered',
      createdAt: new Date().toISOString()
    };
    db2.labOrders.push(created);
    return created;
  });

  const invoice = await createInvoice({
    patientId,
    sourceType: 'order',
    sourceId: order.id,
    lines: [{ description: `${modality}: ${test}`, qty: 1, unitPriceKes: priceKes }]
  });

  await notify({
    userId: patientId,
    title: 'Lab order placed — pay invoice to begin',
    body: `Your ${modality} order (${test}) was placed by ${guard.caller.name}. ${
      invoice ? `Invoice ${invoice.number} for Ksh ${invoice.totalKes} must be paid before the test begins.` : `Pay Ksh ${priceKes} to begin.`
    }`,
    type: 'payment',
    href: invoice ? `/invoice/${invoice.id}` : '/dashboard'
  });
  await recordAudit({
    actorId: guard.caller.userId,
    actorRole: guard.caller.role,
    action: 'lab_order_create',
    resourceType: 'lab_order',
    resourceId: order.id,
    purpose: 'Diagnostics ordering',
    phiAccessed: true
  });

  return NextResponse.json({ order, invoiceId: invoice?.id ?? null }, { status: 201 });
}
