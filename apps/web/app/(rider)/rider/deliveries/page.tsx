import { PackageSearch, Truck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DeliveryCard, type DeliveryView } from '@/components/rider/DeliveryCard';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';

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

export default async function RiderDeliveriesPage() {
  const guard = await requireRole(['rider']);
  if ('error' in guard) redirect('/login');

  const db = await getDb();
  const sorted = db.orders.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const active = sorted.filter((order) => order.status === 'dispatched' || order.status === 'in_transit');
  const recent = sorted.filter((order) => order.status === 'delivered' || order.status === 'failed').slice(0, 6);

  function toView(order: (typeof sorted)[number]): DeliveryView {
    const customer = db.users.find((user) => user.id === order.patientId);
    return {
      id: order.id,
      number: order.number,
      customerName: customer?.fullName ?? 'Unknown customer',
      customerPhone: customer?.phone ?? 'No phone on file',
      address: order.landmark ? `${order.landmark}, ${order.county}` : order.county,
      itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
      totalKes: order.totalKes,
      status: order.status,
      createdAt: relativeTime(order.createdAt)
    };
  }

  return (
    <div>
      <PageHeader
        eyebrow="Rider console"
        title="Deliveries"
        description="Runs released by dispatch, with landmarks and handover totals for each stop."
        action={<Badge tone={active.length > 0 ? 'warning' : 'success'}>{active.length} active {active.length === 1 ? 'run' : 'runs'}</Badge>}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <Truck className="h-4 w-4 text-[var(--color-secondary)]" />
            Active runs
          </h2>
          <span className="text-xs font-semibold text-[var(--color-gray-500)]">{active.length} stops</span>
        </div>
        {active.length === 0 ? (
          <EmptyState
            title="No active runs"
            description="When dispatch releases a delivery to your area it will appear here with the patient landmark."
            icon={PackageSearch}
          />
        ) : (
          <div className="space-y-3">
            {active.map((order) => (
              <DeliveryCard key={order.id} delivery={toView(order)} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <PackageSearch className="h-4 w-4 text-[var(--color-primary)]" />
            Recently closed
          </h2>
          <span className="text-xs font-semibold text-[var(--color-gray-500)]">{recent.length} shown</span>
        </div>
        {recent.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-[var(--color-gray-500)]">No completed runs yet. Finished deliveries are archived here.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {recent.map((order) => (
              <DeliveryCard key={order.id} delivery={toView(order)} />
            ))}
          </div>
        )}
      </section>

      <p className="mt-4 text-xs leading-5 text-[var(--color-gray-500)]">
        Run completion is recorded by dispatch after proof of handover, so statuses here match the audit trail exactly.
      </p>
    </div>
  );
}
