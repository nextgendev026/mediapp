import { AlertTriangle, ArrowRight, ClipboardCheck, FileText, PackageSearch, ShieldCheck, Truck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MetricCard } from '@/components/shared/MetricCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';
import { products } from '@/lib/data';

export const dynamic = 'force-dynamic';

const LOW_STOCK_THRESHOLD = 20;

function shortDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
}

export default async function PharmacistDashboard() {
  const guard = await requireRole(['pharmacist']);
  if ('error' in guard) redirect('/login');

  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);

  const pendingRx = db.prescriptions.filter((rx) => rx.status === 'pending_approval');
  const approvedRx = db.prescriptions.filter((rx) => rx.status === 'approved');
  const dispensedRx = db.prescriptions.filter((rx) => rx.status === 'dispensed');
  const ordersToday = db.orders.filter((order) => order.createdAt.slice(0, 10) === today);
  const openOrders = db.orders.filter((order) => order.status !== 'delivered' && order.status !== 'failed');
  const lowStock = products.filter((product) => product.stock <= LOW_STOCK_THRESHOLD);
  const deliveredOrders = db.orders.filter((order) => order.status === 'delivered');

  const priority = [...pendingRx, ...approvedRx]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        eyebrow="Nairobi Central Pharmacy"
        title="Pharmacy operations"
        description="A clear view of prescriptions, stock, and dispatch today."
        action={
          <Link href="/pharmacist/prescriptions">
            <Button>
              <ClipboardCheck className="h-4 w-4" />
              Open dispensing queue
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pending prescriptions"
          value={String(pendingRx.length)}
          detail={pendingRx.length > 0 ? 'Awaiting pharmacist review' : 'Queue is clear'}
          icon={ClipboardCheck}
          tone="orange"
        />
        <MetricCard
          label="Orders today"
          value={String(ordersToday.length)}
          detail={`${openOrders.length} still open`}
          icon={Truck}
          tone="blue"
        />
        <MetricCard
          label="Low stock"
          value={String(lowStock.length)}
          detail={`At or below ${LOW_STOCK_THRESHOLD} units`}
          icon={PackageSearch}
          tone="orange"
        />
        <MetricCard
          label="Prescriptions dispensed"
          value={String(dispensedRx.length)}
          detail={`${approvedRx.length} approved, awaiting dispense`}
          icon={FileText}
          tone="purple"
        />
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-[var(--color-gray-100)] px-5 py-4">
            <div>
              <h2 className="font-extrabold">Priority prescription queue</h2>
              <p className="mt-1 text-xs text-[var(--color-gray-500)]">Review before the next dispense window</p>
            </div>
            <Link href="/pharmacist/prescriptions" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[var(--color-primary-dark)]">
              View queue
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[var(--color-gray-100)]">
            {priority.length === 0 && (
              <p className="p-5 text-sm text-[var(--color-gray-500)]">No prescriptions are waiting for review.</p>
            )}
            {priority.map((rx) => {
              const patient = db.users.find((user) => user.id === rx.patientId);
              const provider = db.users.find((user) => user.id === rx.providerId);
              const first = rx.items[0];
              return (
                <div key={rx.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold">{first ? first.name : 'Prescription'}</p>
                      <Badge tone={rx.status === 'pending_approval' ? 'warning' : 'success'}>
                        {rx.status === 'pending_approval' ? 'Pending review' : 'Approved'}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--color-gray-500)]">
                      {patient?.fullName ?? 'Unknown patient'} · {provider?.fullName ?? 'Unknown provider'} · {shortDate(rx.date)}
                    </p>
                  </div>
                  <Link
                    href="/pharmacist/prescriptions"
                    className="inline-flex min-h-11 items-center rounded-lg border border-[var(--color-primary)] px-3 text-xs font-bold text-[var(--color-primary-dark)]"
                  >
                    Review
                  </Link>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Inventory alerts</p>
                <h2 className="mt-1 text-lg font-extrabold">Needs attention</h2>
              </div>
              <AlertTriangle className="h-5 w-5 text-[var(--color-accent)]" />
            </div>
            <div className="mt-4 space-y-3">
              {lowStock.length === 0 && (
                <p className="text-sm text-[var(--color-gray-500)]">All catalog items are above the reorder point.</p>
              )}
              {lowStock.map((product) => (
                <div key={product.id} className="flex items-center gap-3 rounded-lg bg-amber-50 p-3">
                  <PackageSearch className="h-4 w-4 text-amber-700" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{product.name}</p>
                    <p className="mt-1 text-xs text-amber-800">{product.stock} units in stock · {product.pharmacy}</p>
                  </div>
                  <Link href="/pharmacist/inventory" className="text-xs font-bold text-amber-800">
                    Reorder
                  </Link>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-green-100 bg-green-50">
            <p className="inline-flex items-center gap-2 text-sm font-extrabold text-green-800">
              <ShieldCheck className="h-4 w-4" />
              Chain of custody healthy
            </p>
            <p className="mt-2 text-xs leading-5 text-green-700">
              {deliveredOrders.length === 0
                ? 'No completed deliveries yet — every dispense is logged the moment it happens.'
                : `All ${deliveredOrders.length} delivered ${deliveredOrders.length === 1 ? 'order has' : 'orders have'} a complete pharmacy-to-patient log.`}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
