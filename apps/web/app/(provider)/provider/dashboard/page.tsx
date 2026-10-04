import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Clock3, FilePlus2, FileText, MessageCircle, UsersRound, Video } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { MetricCard } from '@/components/shared/MetricCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { getDb, type Appointment } from '@/lib/server/store';
import { stageOf } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

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
  return 'neutral';
}

export default async function ProviderDashboard() {
  const guard = await requireRole(['provider']);
  if ('error' in guard) redirect(guard.error.status === 401 ? '/login' : '/dashboard');

  const db = await getDb();
  const callerId = guard.caller.userId;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const mine = db.appointments
    .filter((a) => a.providerId === callerId)
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));

  const todays = mine.filter((a) => a.date === today);
  const completedToday = todays.filter((a) => a.status === 'completed').length;
  const bookedToday = todays.filter((a) => a.status === 'booked').length;
  const next = mine.find((a) => a.status === 'booked' && a.date >= today);

  const encountersMine = db.encounters.filter((e) => e.providerId === callerId);
  const seenThisMonth = encountersMine.filter((e) => e.date.slice(0, 7) === month).length;
  const prescriptionsMine = db.prescriptions.filter((p) => p.providerId === callerId);
  const pendingRx = prescriptionsMine.filter((p) => p.status === 'pending_approval').length;
  const queueActive = todays.filter((a) => {
    if (a.assignedProviderId !== callerId) return false;
    const stage = stageOf(a);
    return stage === 'triage' || stage === 'consultation';
  }).length;

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateLabel = now.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const nextPatient = next ? db.users.find((u) => u.id === next.patientId) : undefined;

  return (
    <div>
      <PageHeader
        eyebrow={dateLabel}
        title={`${greeting}, ${guard.caller.name}`}
        description="Your clinical workspace and schedule for today."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Available for consultations
            </Badge>
            <Link href="/provider/queue">
              <Button variant="outline" size="sm">
                <ClipboardList className="h-3.5 w-3.5" />
                Patient queue · {queueActive}
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Today's visits"
          value={String(todays.length)}
          detail={`${completedToday} completed - ${bookedToday} remaining`}
          icon={CalendarDays}
          tone="blue"
        />
        <MetricCard
          label="Next consultation"
          value={next ? next.time : 'None'}
          detail={next ? `${nextPatient?.fullName ?? 'Patient'} - ${formatDate(next.date)}` : 'No booked visit ahead'}
          icon={Clock3}
          tone="orange"
        />
        <MetricCard
          label="Patients seen this month"
          value={String(seenThisMonth)}
          detail={`${encountersMine.length} encounters recorded`}
          icon={UsersRound}
          tone="green"
        />
        <MetricCard
          label="Pending prescriptions"
          value={String(pendingRx)}
          detail={`${prescriptionsMine.length} issued in total`}
          icon={FileText}
          tone="purple"
        />
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-[var(--color-gray-100)] px-5 py-4">
            <div>
              <h2 className="font-extrabold">Today's schedule</h2>
              <p className="mt-1 text-xs text-[var(--color-gray-500)]">
                {formatDate(today)} - {todays.length} consultation{todays.length === 1 ? '' : 's'}
              </p>
            </div>
            <Link href="/provider/appointments" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[var(--color-primary-dark)]">
              Full calendar
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {todays.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-[var(--color-gray-300)]" />
              <p className="mt-3 font-extrabold">No visits scheduled today</p>
              <p className="mt-1 text-sm text-[var(--color-gray-500)]">Review upcoming bookings or write a prescription.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-gray-100)]">
              {todays.map((appt) => (
                <TodayRow key={appt.id} appointment={appt} patientName={db.users.find((u) => u.id === appt.patientId)?.fullName ?? 'Unknown patient'} />
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Quick actions</p>
                <h2 className="mt-1 text-lg font-extrabold">Jump back in</h2>
              </div>
              <Badge tone="neutral">Workspace</Badge>
            </div>
            <div className="mt-4 space-y-2">
              <InboxRow icon={CalendarDays} title="Appointments" detail="Today's schedule and past visits" tone="text-blue-700 bg-blue-50" href="/provider/appointments" />
              <InboxRow icon={ClipboardList} title="Patient queue" detail={`${queueActive} in triage or consultation assigned to you`} tone="text-emerald-700 bg-emerald-50" href="/provider/queue" />
              <InboxRow icon={UsersRound} title="Patient directory" detail="Search charts, balances and allergies" tone="text-orange-700 bg-orange-50" href="/provider/patients" />
              <InboxRow icon={FilePlus2} title="New prescription" detail="Issue an e-prescription" tone="text-purple-700 bg-purple-50" href="/provider/prescriptions/new" />
              <InboxRow icon={MessageCircle} title="Consultation rooms" detail="Open a room or review SOAP notes" tone="text-green-700 bg-green-50" href="/provider/consultations" />
            </div>
          </Card>

          <Card className="border-green-100 bg-green-50">
            <p className="text-xs font-bold uppercase tracking-wide text-green-700">Clinical safety</p>
            <p className="mt-2 text-sm leading-6 text-green-800">
              All patient access is logged. Review allergies and current medicines before signing any prescription.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TodayRow({ appointment, patientName }: { appointment: Appointment; patientName: string }) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-extrabold text-blue-700">
        {patientName
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')
          .toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{patientName}</p>
        <p className="mt-1 truncate text-xs text-[var(--color-gray-500)]">{appointment.reason}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-gray-600)]">
          <Clock3 className="h-3.5 w-3.5" />
          {appointment.time}
        </span>
        <Badge tone="neutral">{appointment.mode.replace('_', ' ')}</Badge>
        <Badge tone={statusTone(appointment.status)}>{appointment.status.replace(/_/g, ' ')}</Badge>
        {(appointment.status === 'booked' || appointment.status === 'completed') && (
          <Link href={`/provider/consultations/${appointment.id}`}>
            <span className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 text-xs font-bold text-white hover:bg-[var(--color-primary-dark)]">
              <Video className="h-3.5 w-3.5" />
              Open room
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

function InboxRow({ icon: Icon, title, detail, tone, href }: { icon: React.ElementType; title: string; detail: string; tone: string; href: Route }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-[var(--color-gray-50)]">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-[var(--color-gray-500)]">{detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-[var(--color-gray-400)]" />
    </Link>
  );
}
