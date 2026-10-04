import { BarChart3, CreditCard, FileCheck2, PackageCheck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';
import { formatKES } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

const METHODS: { key: 'mpesa' | 'card' | 'cash' | 'sha'; label: string; color: string }[] = [
  { key: 'mpesa', label: 'M-PESA', color: 'bg-[#1da84a]' },
  { key: 'card', label: 'Card', color: 'bg-[var(--color-secondary)]' },
  { key: 'cash', label: 'Cash', color: 'bg-amber-500' },
  { key: 'sha', label: 'SHA', color: 'bg-[var(--color-primary)]' }
];

const RX_STATUSES: { key: 'pending_approval' | 'approved' | 'dispensed' | 'rejected'; label: string; color: string }[] = [
  { key: 'pending_approval', label: 'Pending review', color: 'bg-amber-500' },
  { key: 'approved', label: 'Approved', color: 'bg-[var(--color-primary)]' },
  { key: 'dispensed', label: 'Dispensed', color: 'bg-green-600' },
  { key: 'rejected', label: 'Rejected', color: 'bg-red-500' }
];

function BarRow({ label, detail, value, percent, color }: { label: string; detail: string; value: string; percent: number; color: string }) {
  const width = Math.max(2, Math.min(100, percent));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-bold text-[var(--color-gray-800)]">{label}</span>
        <span className="shrink-0 font-extrabold">{value}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--color-gray-100)]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-xs text-[var(--color-gray-500)]">{detail}</p>
    </div>
  );
}

export default async function PharmacistReportsPage() {
  const guard = await requireRole(['pharmacist']);
  if ('error' in guard) redirect('/login');

  const db = await getDb();

  const revenueByMethod = METHODS.map((method) => {
    const rows = db.payments.filter((payment) => payment.method === method.key);
    return {
      ...method,
      total: rows.reduce((sum, payment) => sum + payment.amountKes, 0),
      count: rows.length
    };
  });
  const revenueTotal = revenueByMethod.reduce((sum, method) => sum + method.total, 0);

  const productCounts = new Map<string, number>();
  let orderItemCount = 0;
  for (const order of db.orders) {
    for (const item of order.items) {
      productCounts.set(item.name, (productCounts.get(item.name) ?? 0) + item.quantity);
      orderItemCount += item.quantity;
    }
  }
  const topProducts = [...productCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topMax = topProducts[0]?.count ?? 1;

  const rxCounts = RX_STATUSES.map((status) => ({
    ...status,
    count: db.prescriptions.filter((rx) => rx.status === status.key).length
  }));
  const rxTotal = rxCounts.reduce((sum, entry) => sum + entry.count, 0);
  const rxMax = Math.max(1, ...rxCounts.map((entry) => entry.count));

  const revenueMax = Math.max(1, ...revenueByMethod.map((method) => method.total));

  return (
    <div>
      <PageHeader
        eyebrow="Operations intelligence"
        title="Reports"
        description="Live revenue, dispensing throughput, and product movement for your licensed pharmacy."
        action={<Badge tone="success"><CreditCard className="h-3.5 w-3.5" />{formatKES(revenueTotal)} collected</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-[var(--color-gray-500)]">Payments recorded</p>
          <p className="mt-2 text-2xl font-extrabold">{db.payments.length}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-gray-500)]">Across M-PESA, card, cash, and SHA</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-gray-500)]">Items dispensed</p>
          <p className="mt-2 text-2xl font-extrabold">{rxCounts.find((entry) => entry.key === 'dispensed')?.count ?? 0}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-gray-500)]">Prescriptions completed at the counter</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-gray-500)]">Units sold in orders</p>
          <p className="mt-2 text-2xl font-extrabold">{orderItemCount}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-gray-500)]">{db.orders.length} orders in the ledger</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Revenue</p>
              <h2 className="mt-1 text-lg font-extrabold">Collected by payment method</h2>
            </div>
            <Badge tone="neutral">{formatKES(revenueTotal)}</Badge>
          </div>
          <div className="mt-5 space-y-4">
            {revenueByMethod.map((method) => (
              <BarRow
                key={method.key}
                label={method.label}
                detail={`${method.count} ${method.count === 1 ? 'payment' : 'payments'}`}
                value={formatKES(method.total)}
                percent={method.total === 0 ? 0 : (method.total / revenueMax) * 100}
                color={method.color}
              />
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Throughput</p>
              <h2 className="mt-1 text-lg font-extrabold">Prescriptions by status</h2>
            </div>
            <Badge tone="neutral">{rxTotal} total</Badge>
          </div>
          <div className="mt-5 space-y-4">
            {rxCounts.map((entry) => (
              <BarRow
                key={entry.key}
                label={entry.label}
                detail={`${rxTotal === 0 ? 0 : Math.round((entry.count / Math.max(1, rxTotal)) * 100)}% of all prescriptions`}
                value={String(entry.count)}
                percent={(entry.count / rxMax) * 100}
                color={entry.color}
              />
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Product movement</p>
            <h2 className="mt-1 text-lg font-extrabold">Top products by units ordered</h2>
          </div>
          <PackageCheck className="h-5 w-5 text-[var(--color-primary)]" />
        </div>
        <div className="mt-5 space-y-4">
          {topProducts.length === 0 && (
            <p className="text-sm text-[var(--color-gray-500)]">No order lines recorded yet.</p>
          )}
          {topProducts.map((product) => (
            <BarRow
              key={product.name}
              label={product.name}
              detail={`${product.count} units across all orders`}
              value={`${product.count}`}
              percent={(product.count / topMax) * 100}
              color="bg-[var(--color-primary)]"
            />
          ))}
        </div>
      </Card>

      <Card className="mt-6 flex items-start gap-3">
        <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-secondary)]" />
        <div>
          <p className="text-sm font-extrabold">Compliance exports</p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-gray-600)]">
            Dispensing registers and payment reconciliations are generated from the same audited records shown here, so
            every figure ties back to an attributed event in the trail.
          </p>
        </div>
      </Card>

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-4">
        <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" />
        <p className="text-xs leading-5 text-[var(--color-gray-600)]">
          Figures refresh with each page load. Payments, prescriptions, and orders come straight from the operational
          store — no manual entry.
        </p>
      </div>
    </div>
  );
}
