import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { RxQueue, type RxView } from '@/components/pharmacy/RxQueue';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';

export const dynamic = 'force-dynamic';

function displayDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function PharmacistPrescriptionsPage() {
  const guard = await requireRole(['pharmacist']);
  if ('error' in guard) redirect('/login');

  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);

  const rows: RxView[] = db.prescriptions
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((rx) => {
      const patient = db.users.find((user) => user.id === rx.patientId);
      const provider = db.users.find((user) => user.id === rx.providerId);
      let signedByName: string | undefined;
      if (rx.signedBy) {
        const signer = db.users.find((user) => user.id === rx.signedBy);
        signedByName = signer ? signer.fullName : rx.signedBy;
      }
      return {
        id: rx.id,
        date: displayDate(rx.date),
        status: rx.status,
        patientName: patient?.fullName ?? 'Unknown patient',
        patientPhone: patient?.phone ?? 'No phone on file',
        providerName: provider?.fullName ?? 'Unknown provider',
        items: rx.items.map((item) => ({
          name: item.name,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          quantity: item.quantity,
          instructions: item.instructions
        })),
        notes: rx.notes,
        signedByName
      } satisfies RxView;
    });

  const summary = {
    pending: db.prescriptions.filter((rx) => rx.status === 'pending_approval').length,
    approved: db.prescriptions.filter((rx) => rx.status === 'approved').length,
    dispensedToday: db.prescriptions.filter((rx) => rx.status === 'dispensed' && rx.date.slice(0, 10) === today).length
  };

  return (
    <div>
      <PageHeader
        eyebrow="Dispensing workflow"
        title="Prescription queue"
        description="Review clinical details, allergies, and notes before approving and dispensing."
        action={<Badge tone="warning">{summary.pending} awaiting review</Badge>}
      />
      <RxQueue rows={rows} summary={summary} />
    </div>
  );
}
