import { CalendarDays, ClipboardList, Clock3, FileText, HeartPulse, PackageCheck, Pill, Receipt, ShieldCheck, Truck, Video } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MetricCard } from '@/components/shared/MetricCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { QuickActions } from '@/components/patient/QuickActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';
import { formatKES } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

function formatDate(value: string): string {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
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

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function PatientDashboard() {
  const guard = await requireRole(['patient']);
  if ('error' in guard) redirect('/login');

  const db = await getDb();
  const patientId = guard.caller.userId;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nowKey = `${today}T${clock}`;
  const apptKey = (date: string, time: string): string => `${date}T${time}`;

  const upcoming = db.appointments
    .filter((a) => a.patientId === patientId && a.status === 'booked' && apptKey(a.date, a.time) >= nowKey)
    .sort((a, b) => (apptKey(a.date, a.time) < apptKey(b.date, b.time) ? -1 : 1));
  const nextAppointment = upcoming[0];

  const pendingPrescriptions = db.prescriptions.filter((p) => p.patientId === patientId && p.status === 'pending_approval');
  const activeOrders = db.orders.filter((o) => o.patientId === patientId && o.status !== 'delivered' && o.status !== 'failed');
  const openInvoices = db.invoices.filter((i) => i.patientId === patientId && i.status !== 'void' && i.totalKes - i.paidKes > 0);
  const balanceKes = openInvoices.reduce((sum, invoice) => sum + (invoice.totalKes - invoice.paidKes), 0);

  const prescriptions = db.prescriptions
    .filter((p) => p.patientId === patientId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const latestPrescription = prescriptions[0];

  const recentOrders = db.orders
    .filter((o) => o.patientId === patientId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3);

  const nextProvider = nextAppointment ? db.users.find((u) => u.id === nextAppointment.providerId) : undefined;
  const firstName = guard.caller.name.split(' ')[0] ?? guard.caller.name;
  const latestPrescriptionProvider = latestPrescription
    ? db.users.find((u) => u.id === latestPrescription.providerId)?.fullName ?? 'Unknown clinician'
    : '';

  const modeLabel = (mode: 'video' | 'chat' | 'in_person'): string =>
    mode === 'in_person' ? 'In-person' : mode === 'video' ? 'Video' : 'Chat';

  return (
    <div>
      <PageHeader
        eyebrow={now.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        title={`${greeting(now.getHours())}, ${firstName}`}
        description="Here is your care snapshot for today."
        action={
          <Badge tone="success">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Your account is protected
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Upcoming appointments"
          value={String(upcoming.length)}
          detail={nextAppointment ? `${formatDate(nextAppointment.date)} · ${nextAppointment.time}` : 'No bookings yet'}
          icon={CalendarDays}
          tone="blue"
        />
        <MetricCard
          label="Prescriptions pending"
          value={String(pendingPrescriptions.length)}
          detail={pendingPrescriptions.length ? 'Awaiting pharmacist review' : 'Nothing awaiting review'}
          icon={HeartPulse}
          tone="green"
        />
        <MetricCard
          label="Active orders"
          value={String(activeOrders.length)}
          detail={activeOrders.length ? 'Being prepared for you' : 'No active orders'}
          icon={Truck}
          tone="orange"
        />
        <MetricCard
          label="Balance due"
          value={formatKES(balanceKes)}
          detail={openInvoices.length ? `${openInvoices.length} invoice${openInvoices.length === 1 ? '' : 's'} unpaid` : 'All invoices settled'}
          icon={Receipt}
          tone="purple"
        />
      </div>

      <div className="mt-7">
        <QuickActions />
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--color-gray-100)] px-5 py-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
              <h2 className="font-extrabold">Upcoming consultation</h2>
            </div>
            <Badge tone={nextAppointment ? 'primary' : 'neutral'}>{nextAppointment ? 'Confirmed' : 'None booked'}</Badge>
          </div>
          {nextAppointment ? (
            <div className="p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#b9ebca] text-xl font-extrabold text-[var(--color-primary-dark)]">
                  {initials(nextProvider?.fullName ?? 'Clinician')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-extrabold">{nextProvider?.fullName ?? 'Unknown clinician'}</p>
                  <p className="mt-1 truncate text-sm text-[var(--color-gray-500)]">{nextProvider?.specialty ?? 'General practice'}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[var(--color-gray-600)]">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden="true" />
                      {formatDate(nextAppointment.date)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden="true" />
                      {nextAppointment.time}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Video className="h-3.5 w-3.5 text-[var(--color-secondary)]" aria-hidden="true" />
                      {modeLabel(nextAppointment.mode)} consultation
                    </span>
                  </div>
                </div>
                <Link href={`/consultations/${nextAppointment.id}`}>
                  <Button size="sm" variant="outline" className="w-full sm:w-auto">
                    Open room
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs leading-5 text-[var(--color-gray-500)]">Reason: {nextAppointment.reason}</p>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-extrabold">No consultation scheduled</p>
                <p className="mt-1 text-sm text-[var(--color-gray-500)]">Pick a licensed clinician and a time that works for you.</p>
              </div>
              <Link href="/consultations/book">
                <Button size="sm" className="w-full sm:w-auto">
                  Book consultation
                </Button>
              </Link>
            </div>
          )}
        </Card>

        <Card className="h-full">
          {latestPrescription ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <Pill className="h-5 w-5" aria-hidden="true" />
                </span>
                <Badge tone={latestPrescription.status === 'rejected' ? 'error' : latestPrescription.status === 'pending_approval' ? 'warning' : latestPrescription.status === 'approved' ? 'success' : 'neutral'}>
                  {latestPrescription.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <h2 className="mt-5 text-balance text-lg font-extrabold">
                {latestPrescription.items.map((item) => item.name).join(', ') || 'Prescription'}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-gray-500)]">
                {latestPrescription.items.length} medicine{latestPrescription.items.length === 1 ? '' : 's'} · Issued {formatDate(latestPrescription.date)}
              </p>
              <div className="mt-4 text-xs font-semibold text-[var(--color-gray-500)]">Prescribed by {latestPrescriptionProvider}</div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/prescriptions/${latestPrescription.id}`}>
                  <Button size="sm">View prescription</Button>
                </Link>
                <Link href="/records" className="flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-bold text-[var(--color-secondary)] hover:underline">
                  Records
                </Link>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <FileText className="h-8 w-8 text-[var(--color-gray-300)]" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold">No prescriptions yet</p>
              <Link href="/prescriptions/upload" className="mt-2 text-xs font-bold text-[var(--color-primary-dark)]">
                Upload one →
              </Link>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-[var(--color-gray-100)] px-5 py-4">
            <div>
              <h2 className="font-extrabold">Recent orders</h2>
              <p className="mt-1 text-xs text-[var(--color-gray-500)]">Your latest pharmacy activity</p>
            </div>
            <Link href="/orders" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[var(--color-primary-dark)]">
              View all →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm font-bold">No orders yet</p>
              <p className="mt-1 text-xs text-[var(--color-gray-500)]">Your pharmacy orders will show up here.</p>
              <Link href="/pharmacy" className="mt-3 inline-block text-xs font-bold text-[var(--color-primary-dark)]">
                Browse the pharmacy →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-gray-100)]">
              {recentOrders.map((order) => (
                <Link
                  href={`/orders/${order.id}/track`}
                  key={order.id}
                  className="flex items-center gap-3 px-5 py-4 transition hover:bg-[var(--color-gray-50)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]">
                    {order.status === 'delivered' ? <FileText className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold">{order.number}</p>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--color-gray-500)]">
                      {order.items.length} item{order.items.length === 1 ? '' : 's'} · {order.method.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatKES(order.totalKes)}</p>
                    <p className="mt-1 text-xs text-[var(--color-gray-500)]">{formatDate(order.createdAt.slice(0, 10))}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6 border-[#cfe0ff] bg-[#f4f8ff]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <PackageCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-[#123b70]">A small health reminder</p>
            <p className="mt-1 text-sm text-[#456687]">
              Keep a bottle of water nearby today and set a gentle reminder for tomorrow morning. Staying hydrated helps your recovery.
            </p>
          </div>
          <Link
            href="/records"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-xs font-bold text-blue-700 hover:bg-blue-50"
          >
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
            Medical records
          </Link>
        </div>
      </Card>
    </div>
  );
}
