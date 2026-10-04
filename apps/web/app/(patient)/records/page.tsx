import { ClipboardList } from 'lucide-react';
import { redirect } from 'next/navigation';
import { RecordTimeline, type RecordEntry } from '@/components/patient/RecordTimeline';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';
import { formatKES } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

function toIso(dateTime: string): string {
  const parsed = new Date(dateTime);
  return Number.isNaN(parsed.getTime()) ? dateTime : parsed.toISOString();
}

export default async function RecordsPage() {
  const guard = await requireRole(['patient']);
  if ('error' in guard) redirect('/login');

  const db = await getDb();
  const patientId = guard.caller.userId;
  const nameOf = (id: string): string => db.users.find((u) => u.id === id)?.fullName ?? 'Unknown clinician';

  const items: RecordEntry[] = [];

  for (const appointment of db.appointments.filter((a) => a.patientId === patientId)) {
    items.push({
      id: appointment.id,
      type: 'appointment',
      at: toIso(`${appointment.date.slice(0, 10)}T${appointment.time}:00`),
      title: `Appointment with ${nameOf(appointment.providerId)}`,
      detail: appointment.reason,
      status: appointment.status,
      href: appointment.status === 'booked' ? `/consultations/${appointment.id}` : null
    });
  }

  for (const encounter of db.encounters.filter((e) => e.patientId === patientId)) {
    items.push({
      id: encounter.id,
      type: 'encounter',
      at: toIso(`${encounter.date.slice(0, 10)}T12:00:00`),
      title: encounter.diagnosis ? `Encounter — ${encounter.diagnosis}` : 'Clinical encounter',
      detail: encounter.soap.assessment || encounter.outcome.replace(/_/g, ' '),
      status: encounter.status,
      href: null
    });
  }

  for (const prescription of db.prescriptions.filter((p) => p.patientId === patientId)) {
    items.push({
      id: prescription.id,
      type: 'prescription',
      at: toIso(`${prescription.date.slice(0, 10)}T12:00:00`),
      title: prescription.items.map((item) => item.name).join(', '),
      detail: prescription.notes || `${prescription.items.length} medicine(s) prescribed by ${nameOf(prescription.providerId)}`,
      status: prescription.status,
      href: `/prescriptions/${prescription.id}`
    });
  }

  for (const referral of db.referrals.filter((r) => r.patientId === patientId)) {
    items.push({
      id: referral.id,
      type: 'referral',
      at: toIso(`${referral.date.slice(0, 10)}T12:00:00`),
      title: `Referred to ${referral.toFacility} (${referral.toLevel})`,
      detail: referral.reason,
      status: referral.status,
      href: null
    });
  }

  for (const invoice of db.invoices.filter((i) => i.patientId === patientId)) {
    items.push({
      id: invoice.id,
      type: 'invoice',
      at: toIso(invoice.issuedAt),
      title: `${invoice.number} — ${formatKES(invoice.totalKes)}`,
      detail: invoice.lines.map((line) => line.description).join('; '),
      status: invoice.status,
      href: `/invoice/${invoice.id}`
    });
  }

  items.sort((a, b) => (a.at < b.at ? 1 : -1));
  const entries = items.slice(0, 120);

  return (
    <div>
      <PageHeader
        eyebrow="Health history"
        title="Medical records"
        description="A single timeline of your consultations, prescriptions, referrals, and bills. Every access to these records is logged."
      />
      {entries.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No medical records yet"
          description="Your consultations, prescriptions, referrals, and invoices will appear here as soon as your care begins."
          actionLabel="Book a consultation"
          actionHref="/consultations/book"
        />
      ) : (
        <RecordTimeline items={entries} />
      )}
    </div>
  );
}
