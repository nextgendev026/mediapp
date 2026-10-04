import { CalendarDays, Clock3, MapPin, MessageCircle, Plus, Receipt, Stethoscope, Video } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CancelAppointmentButton } from '@/components/patient/CancelAppointmentButton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';
import { formatKES } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

type AppointmentStatus = 'booked' | 'completed' | 'cancelled' | 'no_show';
type AppointmentMode = 'video' | 'chat' | 'in_person';

interface Row {
  id: string;
  date: string;
  time: string;
  mode: AppointmentMode;
  status: AppointmentStatus;
  reason: string;
  feeKes: number;
  invoiceId: string | undefined;
  providerName: string;
  providerSpecialty: string;
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  booked: 'Booked',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Missed'
};

const STATUS_TONE: Record<AppointmentStatus, 'success' | 'info' | 'error' | 'neutral'> = {
  booked: 'info',
  completed: 'success',
  cancelled: 'neutral',
  no_show: 'error'
};

const MODE_LABEL: Record<AppointmentMode, string> = {
  video: 'Video consultation',
  chat: 'Secure chat',
  in_person: 'In-person visit'
};

function formatDate(date: string): string {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-KE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function ModeIcon({ mode }: { mode: AppointmentMode }) {
  if (mode === 'video') return <Video className="h-4 w-4" aria-hidden="true" />;
  if (mode === 'chat') return <MessageCircle className="h-4 w-4" aria-hidden="true" />;
  return <Stethoscope className="h-4 w-4" aria-hidden="true" />;
}

function AppointmentCard({ row }: { row: Row }) {
  const upcoming = row.status === 'booked';
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-[var(--color-gray-100)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#b9ebca] text-sm font-extrabold text-[var(--color-primary-dark)]">
            {initials(row.providerName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-extrabold">{row.providerName}</p>
            <p className="mt-1 truncate text-sm text-[var(--color-gray-500)]">{row.providerSpecialty}</p>
          </div>
        </div>
        <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
          {formatDate(row.date)}
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock3 className="h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
          {row.time}
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-[var(--color-secondary)]">
            <ModeIcon mode={row.mode} />
          </span>
          {MODE_LABEL[row.mode]}
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Receipt className="h-4 w-4 shrink-0 text-[var(--color-gray-500)]" aria-hidden="true" />
          {formatKES(row.feeKes)}
        </div>
      </div>
      <p className="px-5 pb-4 text-sm leading-6 text-[var(--color-gray-600)]">{row.reason}</p>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-gray-100)] bg-[var(--color-gray-50)] p-5">
        {upcoming && (
          <Link href={`/consultations/${row.id}`}>
            <Button size="sm">
              <Video className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Open consultation room
            </Button>
          </Link>
        )}
        {row.invoiceId && (
          <Link href={`/invoice/${row.invoiceId}`}>
            <Button variant="outline" size="sm">
              <Receipt className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              View invoice
            </Button>
          </Link>
        )}
        {upcoming && <CancelAppointmentButton appointmentId={row.id} />}
      </div>
    </Card>
  );
}

export default async function ConsultationsPage() {
  const guard = await requireRole(['patient']);
  if ('error' in guard) redirect('/login');

  const db = await getDb();
  const providerName = (id: string): string => db.users.find((u) => u.id === id)?.fullName ?? 'Unknown clinician';

  const rows: Row[] = db.appointments
    .filter((a) => a.patientId === guard.caller.userId)
    .map((a) => ({
      id: a.id,
      date: a.date,
      time: a.time,
      mode: a.mode,
      status: a.status,
      reason: a.reason,
      feeKes: a.feeKes,
      invoiceId: a.invoiceId,
      providerName: providerName(a.providerId),
      providerSpecialty: db.users.find((u) => u.id === a.providerId)?.specialty ?? 'General practice'
    }));

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nowKey = `${today}T${clock}`;

  const key = (row: Row): string => `${row.date}T${row.time}`;
  const upcoming = rows
    .filter((row) => row.status === 'booked' && key(row) >= nowKey)
    .sort((a, b) => (key(a) < key(b) ? -1 : 1));
  const past = rows
    .filter((row) => !(row.status === 'booked' && key(row) >= nowKey))
    .sort((a, b) => (key(a) < key(b) ? 1 : -1));

  return (
    <div>
      <PageHeader
        eyebrow="Care team"
        title="Your consultations"
        description="Book and manage secure conversations with licensed Kenyan clinicians."
        action={
          <Link href="/consultations/book">
            <Button>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Book consultation
            </Button>
          </Link>
        }
      />

      {rows.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title="No consultations yet"
          description="When you book your first consultation it will appear here with its invoice and consultation room."
          actionLabel="Book a consultation"
          actionHref="/consultations/book"
        />
      )}

      {rows.length > 0 && (
        <div className="space-y-7">
          <section aria-labelledby="upcoming-heading">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Next up</p>
                <h2 id="upcoming-heading" className="mt-1 text-xl font-extrabold">
                  Upcoming consultations
                </h2>
              </div>
              <span className="text-xs font-semibold text-[var(--color-gray-500)]">{upcoming.length} booked</span>
            </div>
            {upcoming.length === 0 ? (
              <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-extrabold">Nothing scheduled right now</p>
                  <p className="mt-1 text-sm text-[var(--color-gray-500)]">Pick a clinician and a time that suits you.</p>
                </div>
                <Link href="/consultations/book">
                  <Button size="sm">
                    <Plus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    Book consultation
                  </Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcoming.map((row) => (
                  <AppointmentCard key={row.id} row={row} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section aria-labelledby="past-heading">
              <p className="eyebrow">History</p>
              <h2 id="past-heading" className="mt-1 mb-4 text-xl font-extrabold">
                Past consultations
              </h2>
              <div className="space-y-4">
                {past.map((row) => (
                  <AppointmentCard key={row.id} row={row} />
                ))}
              </div>
            </section>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-gray-200)] bg-white p-4 text-xs leading-5 text-[var(--color-gray-500)]">
            <MapPin className="h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
            Consultations are invoiced at booking and paid via M-PESA. Cancel free of charge up to your appointment time.
          </div>
        </div>
      )}
    </div>
  );
}
