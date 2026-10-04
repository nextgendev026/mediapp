import { ArrowRight, CalendarClock, Check, FileText, Pill, ShieldCheck, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<'pending_approval' | 'approved' | 'dispensed' | 'rejected', string> = {
  pending_approval: 'Awaiting pharmacist',
  approved: 'Approved',
  dispensed: 'Dispensed',
  rejected: 'Rejected'
};

const STATUS_TONE: Record<'pending_approval' | 'approved' | 'dispensed' | 'rejected', 'warning' | 'success' | 'neutral' | 'error'> = {
  pending_approval: 'warning',
  approved: 'success',
  dispensed: 'neutral',
  rejected: 'error'
};

function formatDate(value: string): string {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function PrescriptionDetailPage({ params }: { params: { id: string } }) {
  const guard = await requireRole(['patient']);
  if ('error' in guard) redirect('/login');

  const db = await getDb();
  const prescription = db.prescriptions.find((p) => p.id === params.id && p.patientId === guard.caller.userId);
  if (!prescription) notFound();

  const provider = db.users.find((u) => u.id === prescription.providerId);
  const providerName = provider?.fullName ?? 'Unknown clinician';
  const medicines = prescription.items.map((item) => item.name).join(', ');

  const steps = [
    { key: 'issued', label: 'Issued', done: true },
    { key: 'approved', label: 'Approved', done: prescription.status === 'approved' || prescription.status === 'dispensed' },
    { key: 'dispensed', label: 'Dispensed', done: prescription.status === 'dispensed' }
  ];
  const currentIndex = prescription.status === 'dispensed' ? 2 : prescription.status === 'approved' ? 1 : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Prescription record"
        title={medicines || 'Prescription'}
        description={`Issued ${formatDate(prescription.date)} · ${prescription.items.length} medicine${prescription.items.length === 1 ? '' : 's'} · ${providerName}`}
        backHref="/prescriptions"
        action={<Badge tone={STATUS_TONE[prescription.status]}>{STATUS_LABEL[prescription.status]}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.4fr]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
              <h2 className="font-extrabold">Prescription progress</h2>
            </div>
            <ol className="mt-5 grid grid-cols-3">
              {steps.map((step, index) => {
                const isCurrent = index === currentIndex && prescription.status !== 'rejected';
                const lineDone = step.done && steps[index + 1]?.done;
                return (
                  <li key={step.key} className="relative flex flex-col items-center text-center">
                    {index < steps.length - 1 && (
                      <span
                        className={`absolute left-1/2 top-4 h-0.5 w-full ${lineDone ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-gray-200)]'}`}
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-extrabold ${
                        step.done
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : isCurrent
                            ? 'border-[var(--color-primary)] bg-white text-[var(--color-primary-dark)]'
                            : 'border-[var(--color-gray-300)] bg-white text-[var(--color-gray-500)]'
                      }`}
                    >
                      {step.done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                    </span>
                    <span
                      className={`mt-2 text-xs font-bold ${isCurrent || step.done ? 'text-[var(--color-primary-dark)]' : 'text-[var(--color-gray-500)]'}`}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
            {prescription.status === 'rejected' && (
              <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">
                This prescription was rejected. Contact your care team if you still need these medicines.
              </div>
            )}
            {prescription.status === 'pending_approval' && (
              <p className="mt-5 text-sm leading-6 text-[var(--color-gray-600)]">
                A licensed pharmacist is reviewing this prescription. You will be notified as soon as it is approved.
              </p>
            )}
          </Card>

          <Card className="p-0">
            <div className="flex items-center gap-2 border-b border-[var(--color-gray-100)] px-5 py-4">
              <FileText className="h-4 w-4 text-[var(--color-secondary)]" aria-hidden="true" />
              <h2 className="font-extrabold">Medicines</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-gray-200)] text-xs uppercase tracking-wide text-[var(--color-gray-500)]">
                    <th className="px-5 py-3 font-bold">Medicine</th>
                    <th className="px-3 py-3 font-bold">Dosage</th>
                    <th className="px-3 py-3 font-bold">Frequency</th>
                    <th className="px-3 py-3 font-bold">Duration</th>
                    <th className="px-3 py-3 font-bold">Qty</th>
                    <th className="px-3 py-3 font-bold">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-gray-100)]">
                  {prescription.items.map((item, index) => (
                    <tr key={`${item.name}-${index}`}>
                      <td className="px-5 py-3 font-bold">{item.name}</td>
                      <td className="px-3 py-3">{item.dosage}</td>
                      <td className="px-3 py-3">{item.frequency}</td>
                      <td className="px-3 py-3">{item.duration}</td>
                      <td className="px-3 py-3">{item.quantity}</td>
                      <td className="px-3 py-3 text-[var(--color-gray-600)]">{item.instructions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <p className="eyebrow">Prescribed by</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d8f5e1] text-xs font-extrabold text-[var(--color-primary-dark)]">
                {providerName
                  .split(' ')
                  .filter(Boolean)
                  .map((part) => part.charAt(0))
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-extrabold">{providerName}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--color-gray-500)]">{provider?.specialty ?? 'General practice'}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-gray-100)] pt-4 text-sm font-semibold text-[var(--color-gray-600)]">
              <CalendarClock className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
              Issued {formatDate(prescription.date)}
            </div>
            {prescription.signedBy && (
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-gray-600)]">
                <Stethoscope className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
                Signed by {prescription.signedBy}
              </div>
            )}
          </Card>

          {prescription.notes && (
            <Card>
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
                <h2 className="font-extrabold">Notes</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-gray-600)]">{prescription.notes}</p>
            </Card>
          )}

          {(prescription.status === 'approved' || prescription.status === 'dispensed') && (
            <Card className="bg-[var(--color-primary-light)]">
              <h2 className="text-balance font-extrabold">Ready to order</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-gray-600)]">
                These medicines can be added to your basket and delivered, or collected from an AfyaCommerce pharmacy.
              </p>
              <Link href="/pharmacy" className="mt-4 block">
                <Button className="w-full">
                  Order medicines
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </Card>
          )}

          {prescription.invoiceId && (
            <Link href={`/invoice/${prescription.invoiceId}`} className="block">
              <Button variant="outline" className="w-full">
                View invoice
                <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
