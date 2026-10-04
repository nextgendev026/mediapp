import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';

export const runtime = 'nodejs';

interface TimelineItem { type: string; id: string; at: string; title: string; detail: string; status: string; }

export async function GET(request: Request) {
  const guard = await requireRole(['patient', 'provider', 'admin']);
  if ('error' in guard) return guard.error;
  const url = new URL(request.url);
  const db = await getDb();
  const requested = url.searchParams.get('patientId');
  const patientId = guard.caller.role === 'patient' ? guard.caller.userId : requested;
  if (!patientId) return NextResponse.json({ error: 'patientId required.' }, { status: 400 });
  if (guard.caller.role === 'patient' && patientId !== guard.caller.userId) {
    return NextResponse.json({ error: 'Not permitted.' }, { status: 403 });
  }

  const name = (id: string): string => db.users.find((u) => u.id === id)?.fullName ?? 'Unknown';
  const items: TimelineItem[] = [];

  for (const a of db.appointments.filter((a) => a.patientId === patientId)) {
    items.push({
      type: 'appointment', id: a.id, at: `${a.date}T${a.time}:00`,
      title: `Appointment with ${name(a.providerId)}`, detail: a.reason, status: a.status
    });
  }
  for (const e of db.encounters.filter((e) => e.patientId === patientId)) {
    items.push({
      type: 'encounter', id: e.id, at: `${e.date}T12:00:00`,
      title: `Consultation — ${e.diagnosis || e.outcome}`, detail: e.soap.assessment, status: e.outcome
    });
  }
  for (const p of db.prescriptions.filter((p) => p.patientId === patientId)) {
    items.push({
      type: 'prescription', id: p.id, at: `${p.date}T12:00:00`,
      title: `${p.items.map((i) => i.name).join(', ')}`,
      detail: p.notes || `${p.items.length} medication(s)`, status: p.status
    });
  }
  for (const r of db.referrals.filter((r) => r.patientId === patientId)) {
    items.push({
      type: 'referral', id: r.id, at: `${r.date}T12:00:00`,
      title: `Referred to ${r.toFacility} (${r.toLevel})`, detail: r.reason, status: r.status
    });
  }
  for (const inv of db.invoices.filter((i) => i.patientId === patientId)) {
    items.push({
      type: 'invoice', id: inv.id, at: inv.issuedAt,
      title: `${inv.number} — Ksh ${inv.totalKes}`, detail: inv.lines.map((l) => l.description).join('; '), status: inv.status
    });
  }

  items.sort((a, b) => (a.at < b.at ? 1 : -1));
  return NextResponse.json({ items: items.slice(0, 100) });
}
