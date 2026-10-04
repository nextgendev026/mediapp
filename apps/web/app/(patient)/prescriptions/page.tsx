import { ArrowRight, CalendarClock, Pill, Plus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { getDb, type Prescription } from '@/lib/server/store';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<Prescription['status'], string> = {
  pending_approval: 'Awaiting pharmacist',
  approved: 'Approved',
  dispensed: 'Dispensed',
  rejected: 'Rejected'
};

const STATUS_TONE: Record<Prescription['status'], 'warning' | 'success' | 'neutral' | 'error'> = {
  pending_approval: 'warning',
  approved: 'success',
  dispensed: 'neutral',
  rejected: 'error'
};

function formatDate(value: string): string {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function PrescriptionsPage() {
  const guard = await requireRole(['patient']);
  if ('error' in guard) redirect('/login');

  const db = await getDb();
  const rows = db.prescriptions
    .filter((p) => p.patientId === guard.caller.userId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((p) => ({
      prescription: p,
      providerName: db.users.find((u) => u.id === p.providerId)?.fullName ?? 'Unknown clinician'
    }));

  return (
    <div>
      <PageHeader
        eyebrow="My medicines"
        title="Prescriptions"
        description="Review the medicines your clinicians have prescribed, track pharmacist approval, and share them securely with a pharmacy."
        action={
          <Link href="/prescriptions/upload">
            <Button>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Upload prescription
            </Button>
          </Link>
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
        <p className="text-sm leading-6 text-blue-800">
          <strong>Private by default.</strong> Your prescription history is encrypted and every clinical access is recorded in your personal access log.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Pill}
          title="No prescriptions yet"
          description="Upload a paper prescription or ask your clinician to send one electronically. It will appear here once a pharmacist reviews it."
          actionLabel="Upload prescription"
          actionHref="/prescriptions/upload"
        />
      ) : (
        <div className="space-y-4">
          {rows.map(({ prescription, providerName }) => {
            const medicines = prescription.items.map((item) => item.name).join(', ');
            return (
              <Card key={prescription.id} className="p-0">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]">
                    <Pill className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-balance text-lg font-extrabold">{medicines || 'Prescription'}</h2>
                      <Badge tone={STATUS_TONE[prescription.status]}>{STATUS_LABEL[prescription.status]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-gray-600)]">
                      {prescription.items.length} medicine{prescription.items.length === 1 ? '' : 's'} · {providerName}
                    </p>
                    {prescription.notes && (
                      <p className="mt-2 text-sm leading-6 text-[var(--color-gray-500)]">{prescription.notes}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[var(--color-gray-500)]">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                        Issued {formatDate(prescription.date)}
                      </span>
                      <span>{prescription.items[0]?.dosage ?? ''}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0">
                    <Link href={`/prescriptions/${prescription.id}`}>
                      <Button variant="outline" size="sm">
                        View details
                        <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
