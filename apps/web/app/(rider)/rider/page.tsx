import { ArrowRight, ClipboardList, LifeBuoy, MapPin, PackageCheck, PhoneCall, ShieldCheck, Truck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { getDb, type LocalOrder } from '@/lib/server/store';
import { formatKES } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

function relativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return value.slice(0, 10);
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export default async function RiderDashboard() {
  const guard = await requireRole(['rider']);
  if ('error' in guard) redirect('/login');

  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);

  const activeRuns = db.orders
    .filter((order) => order.status === 'dispatched' || order.status === 'in_transit')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const delivered = db.orders.filter((order) => order.status === 'delivered');
  const newToday = db.orders.filter((order) => order.createdAt.slice(0, 10) === today);
  const firstName = guard.caller.name.split(' ')[0] ?? guard.caller.name;

  return (
    <div>
      <PageHeader
        eyebrow="Rider console"
        title={`Welcome back, ${firstName}`}
        description="Your runs, landmarks, and handover checklist for today."
        action={
          <Link href="/rider/deliveries">
            <Button>
              <Truck className="h-4 w-4" />
              Open deliveries
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-[var(--color-gray-500)]">Active runs</p>
          <p className="mt-1 text-2xl font-extrabold">{activeRuns.length}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-gray-500)]">Dispatched or in transit</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-[var(--color-gray-500)]">Completed deliveries</p>
          <p className="mt-1 text-2xl font-extrabold">{delivered.length}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-gray-500)]">Delivered to patients</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-[var(--color-gray-500)]">New today</p>
          <p className="mt-1 text-2xl font-extrabold">{newToday.length}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-gray-500)]">Orders placed today</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-[var(--color-gray-100)] px-5 py-4">
            <div>
              <h2 className="font-extrabold">Today’s assigned deliveries</h2>
              <p className="mt-1 text-xs text-[var(--color-gray-500)]">Runs released by dispatch for your area</p>
            </div>
            <Link href="/rider/deliveries" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[var(--color-primary-dark)]">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {activeRuns.length === 0 ? (
            <EmptyState
              title="No active runs right now"
              description="Dispatch will post new deliveries here as soon as a pharmacy releases an order."
              icon={PackageCheck}
            />
          ) : (
            <div className="divide-y divide-[var(--color-gray-100)]">
              {activeRuns.slice(0, 5).map((order) => (
                <RunRow key={order.id} order={order} />
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Handover rules</p>
                <h2 className="mt-1 text-lg font-extrabold">Before you knock</h2>
              </div>
              <ShieldCheck className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
            <ul className="mt-4 space-y-3 text-sm text-[var(--color-gray-700)]">
              <li className="flex gap-3">
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-secondary)]" />
                Match the order number with the patient before handing over any package.
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-secondary)]" />
                Ask for a valid ID at handover and keep patient details off open chats.
              </li>
              <li className="flex gap-3">
                <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-secondary)]" />
                Call dispatch if the landmark is wrong, the patient is unreachable, or the seal is broken.
              </li>
              <li className="flex gap-3">
                <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-secondary)]" />
                Do not give medical advice — refer clinical questions to the pharmacy.
              </li>
            </ul>
            <Link href="/help" className="mt-4 inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[var(--color-primary-dark)]">
              Contact support
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card className="border-blue-100 bg-blue-50">
            <p className="text-sm font-extrabold text-blue-800">Completion is confirmed by dispatch</p>
            <p className="mt-1 text-xs leading-5 text-blue-700">
              Runs are closed out by the dispatch team once proof of handover is recorded, so your console always shows
              the authoritative status.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RunRow({ order }: { order: LocalOrder }) {
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
        <Truck className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm font-bold">{order.number}</p>
          <StatusBadge status={order.status} />
          <Badge tone="neutral">{itemCount} items</Badge>
        </div>
        <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--color-gray-500)]">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--color-secondary)]" />
          {order.landmark ? `${order.landmark}, ${order.county}` : order.county}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="text-left sm:text-right">
          <p className="text-sm font-extrabold">{formatKES(order.totalKes)}</p>
          <p className="mt-0.5 text-xs text-[var(--color-gray-500)]">{relativeTime(order.createdAt)}</p>
        </div>
        <Link
          href="/rider/deliveries"
          className="inline-flex min-h-11 items-center rounded-lg border border-[var(--color-primary)] px-3 text-xs font-bold text-[var(--color-primary-dark)]"
        >
          Open run
        </Link>
      </div>
    </div>
  );
}
