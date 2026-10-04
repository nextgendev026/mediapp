import { MapPin, PackageSearch, Truck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { getDb, type LocalOrder, type UserRecord } from '@/lib/server/store';
import { formatKES } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

type ColumnKey = 'new' | 'preparing' | 'out' | 'completed';

const COLUMNS: { key: ColumnKey; title: string; hint: string }[] = [
  { key: 'new', title: 'New', hint: 'Payment confirmed, awaiting preparation' },
  { key: 'preparing', title: 'Preparing', hint: 'Picking and packing medicines' },
  { key: 'out', title: 'Out for delivery', hint: 'Handed to a rider' },
  { key: 'completed', title: 'Completed', hint: 'Delivered or failed' }
];

function groupOf(status: LocalOrder['status']): ColumnKey {
  if (status === 'pending') return 'new';
  if (status === 'confirmed') return 'preparing';
  if (status === 'dispatched' || status === 'in_transit') return 'out';
  return 'completed';
}

function relativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return value.slice(0, 10);
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export default async function PharmacistOrdersPage() {
  const guard = await requireRole(['pharmacist']);
  if ('error' in guard) redirect('/login');

  const db = await getDb();
  const users = db.users;
  const orders = db.orders.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const grouped: Record<ColumnKey, LocalOrder[]> = { new: [], preparing: [], out: [], completed: [] };
  for (const order of orders) grouped[groupOf(order.status)].push(order);

  return (
    <div>
      <PageHeader
        eyebrow="Fulfillment"
        title="Orders board"
        description="Track every order from payment confirmation to handover at the patient’s landmark."
        action={<Badge tone="neutral">Status management via admin console</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((column) => {
          const rows = grouped[column.key];
          return (
            <section key={column.key} className="flex flex-col rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-3">
              <div className="flex items-center justify-between px-1 pb-3">
                <div>
                  <h2 className="text-sm font-extrabold">{column.title}</h2>
                  <p className="mt-0.5 text-xs text-[var(--color-gray-500)]">{column.hint}</p>
                </div>
                <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white px-2 text-xs font-bold text-[var(--color-gray-700)]">
                  {rows.length}
                </span>
              </div>

              <div className="space-y-3">
                {rows.length === 0 ? (
                  <p className="rounded-lg bg-white p-4 text-center text-xs text-[var(--color-gray-500)]">No orders in this stage.</p>
                ) : (
                  rows.map((order) => <OrderCard key={order.id} order={order} users={users} />)
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-5 text-[var(--color-gray-500)]">
        Order status changes are applied through the admin console so every transition is attributed and audited.
      </p>
    </div>
  );
}

function OrderCard({ order, users }: { order: LocalOrder; users: UserRecord[] }) {
  const customer = users.find((user) => user.id === order.patientId);
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  return (
    <Card className="p-0">
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm font-bold">{order.number}</p>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-2 text-sm font-bold">{customer?.fullName ?? 'Unknown customer'}</p>
        <p className="mt-0.5 text-xs text-[var(--color-gray-500)]">
          {customer?.phone ?? 'No phone on file'} · {relativeTime(order.createdAt)}
        </p>

        <ul className="mt-3 space-y-1 rounded-lg bg-[var(--color-gray-50)] p-3">
          {order.items.map((item, index) => (
            <li key={`${order.id}-${index}`} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate font-semibold text-[var(--color-gray-700)]">{item.name}</span>
              <span className="shrink-0 text-[var(--color-gray-500)]">x{item.quantity}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-gray-600)]">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--color-secondary)]" />
          <span className="min-w-0 truncate">{order.landmark ? `${order.landmark}, ${order.county}` : order.county}</span>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-[var(--color-gray-100)] pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-gray-500)]">
            {order.method === 'boda' ? <Truck className="h-3.5 w-3.5" /> : <PackageSearch className="h-3.5 w-3.5" />}
            {itemCount} {itemCount === 1 ? 'item' : 'items'} · {order.method.replace('_', ' ')}
          </span>
          <span className="text-sm font-extrabold">{formatKES(order.totalKes)}</span>
        </div>
      </div>
    </Card>
  );
}
