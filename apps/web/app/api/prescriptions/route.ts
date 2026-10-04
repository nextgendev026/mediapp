import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate, newId, type Prescription, type PrescriptionItem } from '@/lib/server/store';
import { recordAudit } from '@/lib/server/audit';
import { notify } from '@/lib/server/notify';
import { isSameOriginMutation, str } from '@/lib/server/security';

export const runtime = 'nodejs';

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
  const guard = await requireRole(['patient', 'provider', 'pharmacist', 'admin']);
  if ('error' in guard) return guard.error;
  const url = new URL(request.url);
  const db = await getDb();
  let rows = db.prescriptions.slice();
  if (guard.caller.role === 'patient') rows = rows.filter((p) => p.patientId === guard.caller.userId);
  const status = url.searchParams.get('status');
  if (status) rows = rows.filter((p) => p.status === status);
  if (url.searchParams.get('patientId')) {
    const pid = url.searchParams.get('patientId');
    rows = rows.filter((p) => p.patientId === pid);
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  const view = rows.map((p) => ({
    ...p,
    patientName: db.users.find((u) => u.id === p.patientId)?.fullName ?? 'Unknown',
    providerName: db.users.find((u) => u.id === p.providerId)?.fullName ?? 'Unknown'
  }));
  return NextResponse.json({ prescriptions: view });
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
  const notes = str(body.notes ?? '', 600);
  const items = parseItems(body.items);
  if (!items) return NextResponse.json({ error: 'Add at least one medication with dosage and frequency.' }, { status: 400 });

  const db = await getDb();
  const patient = db.users.find((u) => u.id === patientId);
  if (!patient || patient.role !== 'patient') return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });

  const prescription = await mutate((db2) => {
    const p: Prescription = {
      id: newId(),
      patientId,
      providerId: guard.caller.userId,
      date: new Date().toISOString().slice(0, 10),
      items,
      status: 'pending_approval',
      notes: notes || undefined
    };
    db2.prescriptions.push(p);
    return p;
  });

  await notify({
    userId: patientId, title: 'Prescription issued',
    body: `${items.map((i) => i.name).join(', ')} — awaiting pharmacist review.`,
    type: 'prescription', href: '/dashboard'
  });
  await recordAudit({
    actorId: guard.caller.userId, actorRole: guard.caller.role, action: 'prescription_write',
    resourceType: 'prescription', resourceId: prescription.id, purpose: 'Clinical care', phiAccessed: true
  });
  return NextResponse.json({ prescription }, { status: 201 });
}
