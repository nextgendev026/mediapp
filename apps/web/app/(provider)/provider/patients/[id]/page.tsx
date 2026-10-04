import { AlertTriangle, CalendarDays, ClipboardList, FileText, Phone, Pill, Receipt, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';
import { formatKES } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value;
  return `${d} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

function yearsOld(dob?: string | undefined): string | null {
  if (!dob) return null;
  const birth = new Date(dob.slice(0, 10));
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return `${age} yrs`;
}

function toneFor(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  if (status === 'completed' || status === 'paid' || status === 'dispensed' || status === 'approved') return 'success';
  if (status === 'booked' || status === 'issued' || status === 'partially_paid' || status === 'pending_approval') return 'info';
  if (status === 'cancelled' || status === 'rejected' || status === 'void') return 'neutral';
  if (status === 'no_show') return 'warning';
  return 'neutral';
}

function labelFor(status: string): string {
  return status.replace(/_/g, ' ');
}

const SOAP_FIELDS = [
  { key: 'subjective' as const, label: 'Subjective' },
  { key: 'objective' as const, label: 'Objective' },
  { key: 'assessment' as const, label: 'Assessment' },
  { key: 'plan' as const, label: 'Plan' }
];

export default async function PatientChartPage({ params }: { params: { id: string } }) {
  const guard = await requireRole(['provider', 'admin']);
  if ('error' in guard) redirect(guard.error.status === 401 ? '/login' : '/provider/dashboard');

  const db = await getDb();
  const patient = db.users.find((u) => u.id === params.id);
  if (!patient || patient.role !== 'patient') notFound();

  const encounters = db.encounters.filter((e) => e.patientId === patient.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const prescriptions = db.prescriptions.filter((p) => p.patientId === patient.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const referrals = db.referrals.filter((r) => r.patientId === patient.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const appointments = db.appointments.filter((a) => a.patientId === patient.id).sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  const invoices = db.invoices.filter((i) => i.patientId === patient.id).sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
  const allergies = patient.allergies ?? [];
  const openBalance = invoices.reduce((sum, inv) => (inv.status === 'void' ? sum : sum + Math.max(0, inv.totalKes - inv.paidKes)), 0);
  const age = yearsOld(patient.dob);

  return (
    <div>
      <PageHeader
        eyebrow="Patient chart"
        title={patient.fullName}
        description={`${patient.phone}${age ? ` - ${age}` : ''}${patient.dob ? ` - DOB ${formatDate(patient.dob)}` : ''}`}
        backHref="/provider/patients"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/provider/prescriptions/new?patientId=${patient.id}`}>
              <Button>
                <Pill className="h-4 w-4" />
                Write prescription
              </Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-lg font-extrabold text-blue-700">
              {patient.fullName
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase()}
            </span>
            <div>
              <p className="text-lg font-extrabold">{patient.fullName}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-gray-600)]">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {patient.phone}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5" />
                  {patient.gender ?? 'Sex not recorded'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {patient.county ?? 'County not recorded'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5" />
                  {openBalance > 0 ? `${formatKES(openBalance)} open balance` : 'Account settled'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{encounters.length} encounters</Badge>
            <Badge tone="neutral">{prescriptions.length} prescriptions</Badge>
            <Badge tone="neutral">{appointments.length} appointments</Badge>
          </div>
        </div>
        {allergies.length > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
            <p className="text-sm leading-6 text-red-800">
              <span className="font-extrabold">Allergies: {allergies.join(', ')}.</span> Verify before prescribing any medicine.
            </p>
          </div>
        )}
      </Card>

      <Card className="mb-5" >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-[var(--color-primary)]" />
          <h2 className="font-extrabold">Clinical timeline</h2>
          <Badge tone="neutral">{encounters.length} records</Badge>
        </div>
        {encounters.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-gray-500)]">No consultations recorded yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {encounters.map((encounter) => (
              <details key={encounter.id} className="rounded-xl border border-[var(--color-gray-200)] bg-white">
                <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold">{formatDate(encounter.date)}</span>
                    <Badge tone="neutral">{encounter.type.replace(/_/g, ' ')}</Badge>
                    <Badge tone={toneFor(encounter.outcome)}>{labelFor(encounter.outcome)}</Badge>
                  </span>
                  <span className="min-w-0 truncate text-xs font-semibold text-[var(--color-gray-600)]">
                    {encounter.diagnosis || encounter.soap.assessment}
                  </span>
                </summary>
                <div className="border-t border-[var(--color-gray-100)] px-4 py-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {SOAP_FIELDS.map((field) => (
                      <div key={field.key} className="rounded-lg bg-[var(--color-gray-50)] p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-gray-500)]">{field.label}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--color-gray-700)]">{encounter.soap[field.key]}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-gray-600)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5" />
                      Clinician: {db.users.find((u) => u.id === encounter.providerId)?.fullName ?? 'Unknown'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Status: {labelFor(encounter.status)}
                    </span>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="font-extrabold">Prescriptions</h2>
          </div>
          {prescriptions.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-gray-500)]">No prescriptions issued yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {prescriptions.map((rx) => (
                <div key={rx.id} className="rounded-xl border border-[var(--color-gray-200)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-extrabold">{formatDate(rx.date)}</span>
                    <Badge tone={toneFor(rx.status)}>{labelFor(rx.status)}</Badge>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--color-gray-700)]">
                    {rx.items.map((item, index) => (
                      <li key={`${rx.id}-${index}`}>
                        {item.name}
                        {item.dosage ? ` - ${item.dosage}` : ''}
                        {item.frequency ? ` - ${item.frequency}` : ''}
                        {item.duration ? ` - ${item.duration}` : ''}
                      </li>
                    ))}
                  </ul>
                  {rx.notes && <p className="mt-2 text-xs leading-5 text-[var(--color-gray-500)]">{rx.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="font-extrabold">Referrals</h2>
          </div>
          {referrals.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-gray-500)]">No referrals issued yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {referrals.map((referral) => (
                <div key={referral.id} className="rounded-xl border border-[var(--color-gray-200)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-extrabold">{formatDate(referral.date)}</span>
                    <Badge tone={referral.urgency === 'routine' ? 'info' : 'warning'}>{referral.urgency}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{referral.toFacility}</p>
                  <p className="mt-1 text-xs text-[var(--color-gray-500)]">
                    {referral.toLevel} - {labelFor(referral.status)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-gray-600)]">{referral.reason}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="font-extrabold">Appointments</h2>
          </div>
          {appointments.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-gray-500)]">No appointments booked yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {appointments.map((appt) => (
                <div key={appt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-gray-200)] p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold">
                      {formatDate(appt.date)} - {appt.time}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--color-gray-500)]">
                      {appt.mode.replace('_', ' ')} - {appt.reason}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[var(--color-gray-600)]">
                      {db.users.find((u) => u.id === appt.providerId)?.fullName ?? 'Unknown clinician'}
                    </p>
                  </div>
                  <Badge tone={toneFor(appt.status)}>{labelFor(appt.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="font-extrabold">Invoices</h2>
            {openBalance > 0 && <Badge tone="warning">{formatKES(openBalance)} due</Badge>}
          </div>
          {invoices.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-gray-500)]">No invoices issued yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {invoices.map((inv) => (
                <div key={inv.id} className="rounded-xl border border-[var(--color-gray-200)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/invoice/${inv.id}`} className="text-sm font-extrabold text-[var(--color-primary-dark)] hover:underline">
                      {inv.number}
                    </Link>
                    <Badge tone={toneFor(inv.status)}>{labelFor(inv.status)}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-gray-600)]">
                    <span>Total {formatKES(inv.totalKes)}</span>
                    <span>Paid {formatKES(inv.paidKes)}</span>
                    <span className={inv.totalKes - inv.paidKes > 0 ? 'font-bold text-red-700' : 'font-bold text-green-700'}>
                      Balance {formatKES(Math.max(0, inv.totalKes - inv.paidKes))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
