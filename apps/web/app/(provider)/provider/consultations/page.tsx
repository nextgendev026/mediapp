import { ArrowRight, CalendarDays, ClipboardList, FileText, Video } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { getDb, type Encounter } from '@/lib/server/store';

export const dynamic = 'force-dynamic';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value;
  return `${d} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

const SOAP_FIELDS = [
  { key: 'subjective' as const, label: 'Subjective' },
  { key: 'objective' as const, label: 'Objective' },
  { key: 'assessment' as const, label: 'Assessment' },
  { key: 'plan' as const, label: 'Plan' }
];

function outcomeTone(outcome: string): 'success' | 'warning' | 'info' | 'neutral' {
  if (outcome === 'prescription') return 'info';
  if (outcome === 'referral') return 'warning';
  if (outcome === 'admission') return 'warning';
  return 'success';
}

function EncounterRow({ encounter, providerName }: { encounter: Encounter; providerName: string }) {
  return (
    <details className="rounded-xl border border-[var(--color-gray-200)] bg-white">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold">{formatDate(encounter.date)}</span>
          <Badge tone="neutral">{encounter.type.replace(/_/g, ' ')}</Badge>
          <Badge tone={outcomeTone(encounter.outcome)}>{encounter.outcome.replace(/_/g, ' ')}</Badge>
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
        <p className="mt-3 text-xs font-semibold text-[var(--color-gray-500)]">Recorded by {providerName}</p>
      </div>
    </details>
  );
}

export default async function ProviderConsultationsPage() {
  const guard = await requireRole(['provider']);
  if ('error' in guard) redirect(guard.error.status === 401 ? '/login' : '/provider/dashboard');

  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const callerId = guard.caller.userId;

  const booked = db.appointments
    .filter((a) => a.providerId === callerId && a.status === 'booked')
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));

  const encounters = db.encounters
    .filter((e) => e.providerId === callerId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <PageHeader
        eyebrow="Secure rooms"
        title="Consultation rooms"
        description="Open a live room for a booked visit, or expand any past encounter to review the SOAP notes."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/provider/queue">
              <Button>
                Open patient queue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/provider/appointments">
              <Button variant="outline" size="sm">
                <CalendarDays className="h-3.5 w-3.5" />
                View schedule
              </Button>
            </Link>
          </div>
        }
      />

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold">Booked appointments</h2>
          <p className="text-xs font-semibold text-[var(--color-gray-500)]">Ready for consultation</p>
        </div>
        {booked.length === 0 ? (
          <EmptyState
            title="No booked appointments"
            description="When a patient books a consultation with you, the room appears here and you can open it from the schedule."
            actionLabel="Open schedule"
            actionHref="/provider/appointments"
            icon={Video}
          />
        ) : (
          <div className="space-y-3">
            {booked.map((appt) => {
              const patient = db.users.find((u) => u.id === appt.patientId);
              const isToday = appt.date === today;
              return (
                <Card key={appt.id} className="p-0">
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-extrabold text-blue-700">
                      {(patient?.fullName ?? 'Unknown')
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-extrabold">{patient?.fullName ?? 'Unknown patient'}</p>
                        <Badge tone="neutral">{appt.mode.replace('_', ' ')}</Badge>
                        {isToday && <Badge tone="primary">Today</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-gray-600)]">{appt.reason}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--color-gray-500)]">
                        {formatDate(appt.date)} at {appt.time}
                      </p>
                    </div>
                    <Link href={`/provider/consultations/${appt.id}`}>
                      <Button size="sm">
                        <Video className="h-3.5 w-3.5" />
                        Open room
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold">Encounter history</h2>
          <p className="text-xs font-semibold text-[var(--color-gray-500)]">
            {encounters.length} recorded encounter{encounters.length === 1 ? '' : 's'}
          </p>
        </div>
        {encounters.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-center">
            <ClipboardList className="h-8 w-8 text-[var(--color-gray-300)]" />
            <p className="font-extrabold">No encounters yet</p>
            <p className="max-w-md text-sm text-[var(--color-gray-500)]">
              Signed SOAP notes from your consultations will be listed here for quick review.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {encounters.map((encounter) => (
              <EncounterRow key={encounter.id} encounter={encounter} providerName={guard.caller.name} />
            ))}
          </div>
        )}
      </section>

      <p className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-gray-500)]">
        <FileText className="h-4 w-4" />
        Notes are access-logged. Open a room to continue a conversation with the patient.
      </p>
    </div>
  );
}
