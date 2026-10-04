import { CalendarDays, Clock3, MapPin, UsersRound } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AppointmentActions } from '@/components/provider/AppointmentActions';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { getDb, type Appointment } from '@/lib/server/store';
import { formatKES } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

type Row = Appointment & { patientName: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value;
  return `${d} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

function statusTone(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'booked') return 'info';
  if (status === 'no_show') return 'warning';
  if (status === 'cancelled') return 'neutral';
  return 'neutral';
}

function AppointmentCard({ row }: { row: Row }) {
  return (
    <Card className="p-0">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
        <div className="flex items-center gap-3 sm:w-40 sm:flex-col sm:items-start">
          <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[var(--color-primary-dark)]">
            <Clock3 className="h-4 w-4" />
            {row.time}
          </span>
          <span className="text-xs font-semibold text-[var(--color-gray-500)]">{formatDate(row.date)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-extrabold">{row.patientName}</p>
            <Badge tone="neutral">{row.mode.replace('_', ' ')}</Badge>
            <Badge tone={statusTone(row.status)}>{row.status.replace(/_/g, ' ')}</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--color-gray-600)]">{row.reason}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-gray-500)]">Fee {formatKES(row.feeKes)}</p>
        </div>
      </div>
      <div className="border-t border-[var(--color-gray-100)] p-4">
        <AppointmentActions id={row.id} status={row.status} invoiceId={row.invoiceId} />
      </div>
    </Card>
  );
}

function Section({ title, hint, rows }: { title: string; hint: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-8 first:mt-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <p className="text-xs font-semibold text-[var(--color-gray-500)]">
          {hint} - {rows.length} appointment{rows.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <AppointmentCard key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

export default async function ProviderAppointmentsPage() {
  const guard = await requireRole(['provider']);
  if ('error' in guard) redirect(guard.error.status === 401 ? '/login' : '/provider/dashboard');

  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows: Row[] = db.appointments
    .filter((a) => a.providerId === guard.caller.userId)
    .map((a) => ({ ...a, patientName: db.users.find((u) => u.id === a.patientId)?.fullName ?? 'Unknown patient' }))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));

  const todays = rows.filter((a) => a.date === today);
  const upcoming = rows.filter((a) => a.date > today);
  const past = rows.filter((a) => a.date < today).reverse();

  return (
    <div>
      <PageHeader
        eyebrow="Schedule"
        title="Appointments"
        description="Your consultation calendar for today, upcoming visits, and completed history. Open a room to review notes or complete a visit."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-gray-200)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-gray-600)]">
            <UsersRound className="h-4 w-4 text-[var(--color-primary)]" />
            {todays.length} today - {upcoming.length} upcoming
          </span>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No appointments yet"
          description="Booked consultations appear here as soon as patients schedule with you."
          icon={CalendarDays}
        />
      ) : (
        <>
          <Section title="Today" hint={formatDate(today)} rows={todays} />
          <Section title="Upcoming" hint="Next visits" rows={upcoming} />
          <Section title="Past" hint="Earlier visits" rows={past} />
          {todays.length === 0 && upcoming.length === 0 && past.length > 0 && (
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-[var(--color-gray-500)]">
              <MapPin className="h-4 w-4" />
              Nothing scheduled right now - your history is below.
            </p>
          )}
        </>
      )}
    </div>
  );
}
