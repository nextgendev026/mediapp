import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const guard = await requireRole(['provider', 'admin']);
  if ('error' in guard) return guard.error;

  const db = await getDb();
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  const callerId = guard.caller.userId;

  const patients = db.users
    .filter((u) => u.role === 'patient' && u.status === 'active')
    .filter((u) => !q || u.fullName.toLowerCase().includes(q) || u.phone.toLowerCase().includes(q))
    .map((u) => {
      const encounters = db.encounters.filter((e) => e.patientId === u.id);
      let lastVisitAt: string | undefined;
      for (const e of encounters) {
        if (!lastVisitAt || e.date > lastVisitAt) lastVisitAt = e.date;
      }

      const booked = db.appointments
        .filter((a) => a.patientId === u.id && a.status === 'booked')
        .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
      const upcoming = booked.filter((a) => a.date >= today);
      const next =
        upcoming.find((a) => a.providerId === callerId) ??
        upcoming[0] ??
        booked.find((a) => a.providerId === callerId) ??
        booked[0];

      const openBalance = db.invoices
        .filter((inv) => inv.patientId === u.id && inv.status !== 'void')
        .reduce((sum, inv) => sum + Math.max(0, inv.totalKes - inv.paidKes), 0);

      return {
        id: u.id,
        fullName: u.fullName,
        phone: u.phone,
        county: u.county,
        gender: u.gender,
        dob: u.dob,
        allergies: u.allergies,
        createdAt: u.createdAt,
        lastVisitAt,
        encounterCount: encounters.length,
        nextAppointment: next
          ? { id: next.id, date: next.date, time: next.time, mode: next.mode, status: next.status, providerId: next.providerId }
          : null,
        openBalance
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return NextResponse.json({ patients });
}
