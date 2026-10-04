import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate, newId, type Encounter, type Prescription, type PrescriptionItem, type Referral } from '@/lib/server/store';
import { recordAudit } from '@/lib/server/audit';
import { createInvoice } from '@/lib/server/billing';
import { notify } from '@/lib/server/notify';
import { enumOf, isSameOriginMutation, str } from '@/lib/server/security';
import { VisitStage } from '@/lib/workflow';
import { moveVisit } from '@/lib/server/visits';

export const runtime = 'nodejs';

const OUTCOMES = ['treatment', 'prescription', 'referral', 'admission'] as const;
const TO_LEVELS = ['Level 4', 'Level 5', 'Level 6', 'specialist clinic'] as const;

interface SoapBody { subjective: string; objective: string; assessment: string; plan: string; }

function parseSoap(raw: unknown): SoapBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const out = { subjective: '', objective: '', assessment: '', plan: '' } as SoapBody;
  for (const key of ['subjective', 'objective', 'assessment', 'plan'] as const) {
    const value = typeof r[key] === 'string' ? (r[key] as string).trim() : '';
    if (!value) return null;
    out[key] = str(value, 4000);
  }
  return out;
}

function parseItems(raw: unknown): PrescriptionItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items: PrescriptionItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) return null;
    const r = entry as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) return null;
    items.push({
      name: str(name, 160),
      dosage: str(r.dosage ?? '', 80),
      frequency: str(r.frequency ?? '', 80),
      duration: str(r.duration ?? '', 60),
      quantity: Math.max(1, Math.min(500, Number(r.quantity) || 1)),
      instructions: str(r.instructions ?? '', 300)
    });
  }
  return items;
}

export async function GET(request: Request) {
  const guard = await requireRole(['patient', 'provider', 'admin']);
  if ('error' in guard) return guard.error;
  const url = new URL(request.url);
  const db = await getDb();

  const patientId = url.searchParams.get('patientId');
  let rows = db.encounters.slice();
  if (guard.caller.role === 'patient') {
    rows = rows.filter((e) => e.patientId === guard.caller.userId);
  } else if (patientId) {
    rows = rows.filter((e) => e.patientId === patientId);
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));

  const view = rows.map((e) => ({
    ...e,
    patientName: db.users.find((u) => u.id === e.patientId)?.fullName ?? 'Unknown',
    providerName: db.users.find((u) => u.id === e.providerId)?.fullName ?? 'Unknown'
  }));
  return NextResponse.json({ encounters: view });
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
  const appointmentId = typeof body.appointmentId === 'string' && body.appointmentId ? body.appointmentId : undefined;
  const soap = parseSoap(body.soap);
  const outcome = enumOf(body.outcome, OUTCOMES);
  const diagnosis = str(body.diagnosis ?? '', 200);
  const outcomeNote = str(body.outcomeNote ?? '', 600);

  if (!soap) return NextResponse.json({ error: 'Complete all SOAP sections (S, O, A, P).' }, { status: 400 });
  if (!outcome) return NextResponse.json({ error: 'Choose a clinical outcome.' }, { status: 400 });

  const db = await getDb();
  const patient = db.users.find((u) => u.id === patientId);
  if (!patient || patient.role !== 'patient') return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });

  let items: PrescriptionItem[] | null = null;
  if (outcome === 'prescription') {
    items = parseItems(body.items);
    if (!items) return NextResponse.json({ error: 'Add at least one medication with dosage and frequency.' }, { status: 400 });
  }

  const toFacility = outcome === 'referral' ? str(body.toFacility ?? '', 200) : '';
  const toLevel = enumOf(body.toLevel, TO_LEVELS);
  if (outcome === 'referral' && (!toFacility || !toLevel)) {
    return NextResponse.json({ error: 'Referrals need a destination facility and KEPH level.' }, { status: 400 });
  }

  if (appointmentId) {
    const appt = db.appointments.find((a) => a.id === appointmentId);
    if (!appt || appt.patientId !== patientId) return NextResponse.json({ error: 'Appointment mismatch.' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const encounter: Encounter = {
    id: newId(),
    appointmentId,
    patientId,
    providerId: guard.caller.userId,
    date: today,
    type: appointmentId ? 'consultation' : 'consultation',
    soap,
    diagnosis: diagnosis || undefined,
    outcome,
    status: 'closed'
  };

  await mutate((db2) => db2.encounters.push(encounter));

  let createdPrescription: Prescription | null = null;
  let createdReferral: Referral | null = null;
  const doctorName = db.users.find((u) => u.id === guard.caller.userId)?.fullName ?? 'your doctor';

  if (outcome === 'prescription' && items) {
    createdPrescription = await mutate((db2) => {
      const p: Prescription = {
        id: newId(),
        encounterId: encounter.id,
        patientId,
        providerId: guard.caller.userId,
        date: today,
        items,
        status: 'pending_approval',
        notes: outcomeNote || undefined
      };
      db2.prescriptions.push(p);
      return p;
    });
    await notify({
      userId: patientId, title: 'Prescription issued',
      body: `Dr. ${doctorName} prescribed ${items.map((i) => i.name).join(', ')}. A pharmacist will review it shortly.`,
      type: 'prescription', href: '/dashboard'
    });
  }

  if (outcome === 'referral' && toFacility && toLevel) {
    createdReferral = await mutate((db2) => {
      const r: Referral = {
        id: newId(),
        encounterId: encounter.id,
        patientId,
        fromProviderId: guard.caller.userId,
        toFacility,
        toLevel,
        urgency: 'routine',
        reason: soap.assessment,
        clinicalSummary: outcomeNote || `${soap.subjective} / ${soap.objective} / ${soap.plan}`,
        status: 'issued',
        date: today
      };
      db2.referrals.push(r);
      return r;
    });
    await notify({
      userId: patientId, title: 'Referral issued',
      body: `You have been referred to ${toFacility} (${toLevel}).`,
      type: 'appointment', href: '/dashboard'
    });
  }

  if (appointmentId) {
    await moveVisit(
      appointmentId,
      outcome === 'prescription' && items ? VisitStage.Prescription : VisitStage.Diagnosis,
      { system: true }
    );
  }

  const invoice = await createInvoice({
    patientId,
    sourceType: 'consultation',
    sourceId: appointmentId ?? encounter.id,
    lines: [{ description: `Clinical encounter — ${diagnosis || soap.assessment.slice(0, 60)}`, qty: 1, unitPriceKes: 1500 }]
  });
  if (invoice) {
    await notify({
      userId: patientId, title: `Invoice ${invoice.number} issued`,
      body: `Ksh ${invoice.totalKes} for today's consultation.`,
      type: 'payment', href: `/invoice/${invoice.id}`
    });
  }

  await recordAudit({
    actorId: guard.caller.userId, actorRole: guard.caller.role, action: 'encounter_note_signed',
    resourceType: 'encounter', resourceId: encounter.id, purpose: 'Clinical care', phiAccessed: true
  });

  return NextResponse.json(
    { encounter, prescription: createdPrescription, referral: createdReferral, invoiceId: invoice?.id ?? null },
    { status: 201 }
  );
}
