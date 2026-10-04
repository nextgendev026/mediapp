import { redirect } from 'next/navigation';
import { AlertTriangle, Banknote, BedDouble, CalendarClock, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { accrualDays, accrualTotal, listInvoices, listPayments, receivablesAging } from '@/lib/server/billing';
import { computeDormantUserIds } from '@/lib/server/queries';
import { getDb } from '@/lib/server/store';
import { formatKES } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

export default async function AccountingPage() {
  const guard = await requireRole(['admin']);
  if ('error' in guard) redirect('/login');

  const [invoices, payments, aging, dormant, db] = await Promise.all([
    listInvoices(),
    listPayments(),
    receivablesAging(),
    computeDormantUserIds(60),
    getDb()
  ]);

  const revenue = payments.reduce((sum, p) => sum + p.amountKes, 0);
  const outstanding = invoices.reduce((sum, i) => sum + Math.max(0, i.balanceKes), 0);
  const admissions = db.admissions
    .filter((a) => a.status === 'active')
    .map((a) => ({
      ...a,
      patientName: db.users.find((u) => u.id === a.patientId)?.fullName ?? 'Unknown',
      days: accrualDays(a.admittedAt),
      accruedKes: accrualTotal(a.dailyRateKes, a.admittedAt)
    }));

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Accounting &amp; billing"
        description="Invoices, payments, inpatient accruals, receivables aging, and dormant account flags."
        action={<Badge tone="neutral">{invoices.length} invoices</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Banknote} label="Collected" value={formatKES(revenue)} tone="green" />
        <Kpi icon={Receipt} label="Outstanding" value={formatKES(outstanding)} tone="orange" />
        <Kpi icon={CalendarClock} label="Overdue patients" value={String(aging.byPatient.filter((p) => p.daysOverdue > 0).length)} tone="blue" />
        <Kpi icon={AlertTriangle} label="Dormant flagged" value={String(dormant.length)} tone="orange" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="overflow-x-auto p-0">
            <div className="px-5 pt-5">
              <p className="eyebrow">Receivables</p>
              <h2 className="mt-1 text-lg font-extrabold">Invoices</h2>
            </div>
            <table className="mt-4 w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-[var(--color-gray-200)] bg-[var(--color-gray-50)] text-xs uppercase tracking-wide text-[var(--color-gray-500)]">
                <tr>
                  <th className="px-5 py-3 font-bold">Invoice</th>
                  <th className="px-4 py-3 font-bold">Patient</th>
                  <th className="px-4 py-3 font-bold">Issued</th>
                  <th className="px-4 py-3 font-bold">Total</th>
                  <th className="px-4 py-3 font-bold">Paid</th>
                  <th className="px-4 py-3 font-bold">Balance</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-gray-100)]">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-5 py-3 font-mono text-xs font-bold">{inv.number}</td>
                    <td className="px-4 py-3">{inv.patientName}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-gray-500)]">{new Date(inv.issuedAt).toLocaleDateString('en-KE')}</td>
                    <td className="px-4 py-3 font-bold">{formatKES(inv.totalKes)}</td>
                    <td className="px-4 py-3">{formatKES(inv.paidKes)}</td>
                    <td className={`px-4 py-3 font-bold ${inv.balanceKes > 0 ? 'text-orange-700' : 'text-green-700'}`}>{formatKES(inv.balanceKes)}</td>
                    <td className="px-4 py-3"><Badge tone={inv.status === 'paid' ? 'success' : inv.status === 'void' ? 'neutral' : 'warning'}>{inv.status.replace('_', ' ')}</Badge></td>
                    <td className="px-5 py-3"><a className="text-xs font-bold text-[var(--color-primary-dark)] hover:underline" href={`/invoice/${inv.id}`}>View / print</a></td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-[var(--color-gray-500)]">No invoices yet.</td></tr>}
              </tbody>
            </table>
          </Card>

          <Card className="overflow-x-auto p-0">
            <div className="px-5 pt-5">
              <p className="eyebrow">Ledger</p>
              <h2 className="mt-1 text-lg font-extrabold">Payments received</h2>
            </div>
            <table className="mt-4 w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--color-gray-200)] bg-[var(--color-gray-50)] text-xs uppercase tracking-wide text-[var(--color-gray-500)]">
                <tr>
                  <th className="px-5 py-3 font-bold">Receipt</th>
                  <th className="px-4 py-3 font-bold">Patient</th>
                  <th className="px-4 py-3 font-bold">Invoice</th>
                  <th className="px-4 py-3 font-bold">Method</th>
                  <th className="px-4 py-3 font-bold">Reference</th>
                  <th className="px-4 py-3 font-bold">Amount</th>
                  <th className="px-5 py-3 font-bold">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-gray-100)]">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 font-mono text-xs font-bold">{p.receiptNo}</td>
                    <td className="px-4 py-3">{p.patientName}</td>
                    <td className="px-4 py-3 text-xs">{p.invoiceNumber ?? '—'}</td>
                    <td className="px-4 py-3"><Badge tone="neutral">{p.method}</Badge></td>
                    <td className="px-4 py-3 font-mono text-xs">{p.reference}</td>
                    <td className="px-4 py-3 font-bold">{formatKES(p.amountKes)}</td>
                    <td className="px-5 py-3 text-xs text-[var(--color-gray-500)]">{new Date(p.paidAt).toLocaleString('en-KE')}</td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-[var(--color-gray-500)]">No payments recorded.</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <p className="eyebrow">Aging</p>
            <h2 className="mt-1 text-lg font-extrabold">Receivables by age</h2>
            <div className="mt-4 space-y-3">
              {aging.total.map((bucket) => (
                <div key={bucket.label} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-gray-600)]">{bucket.label} <span className="text-xs">({bucket.count})</span></span>
                  <span className="font-extrabold">{formatKES(bucket.amountKes)}</span>
                </div>
              ))}
            </div>
            {aging.byPatient.length > 0 && (
              <div className="mt-4 border-t border-[var(--color-gray-100)] pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">Top balances</p>
                <div className="mt-2 space-y-2">
                  {aging.byPatient.slice(0, 5).map((p) => (
                    <div key={p.patientId} className="flex items-center justify-between text-sm">
                      <span>{p.patientName}{p.daysOverdue > 0 && <span className="ml-1 text-xs text-orange-700">{p.daysOverdue}d overdue</span>}</span>
                      <span className="font-bold">{formatKES(p.balanceKes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <p className="eyebrow">Inpatients</p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold"><BedDouble className="h-5 w-5 text-[var(--color-primary-dark)]" />Active accruals</h2>
            <div className="mt-4 space-y-3">
              {admissions.length === 0 && <p className="text-sm text-[var(--color-gray-500)]">No active admissions.</p>}
              {admissions.map((a) => (
                <div key={a.id} className="rounded-lg bg-[var(--color-gray-50)] p-3 text-sm">
                  <p className="font-bold">{a.patientName} — {a.ward} {a.bedNo}</p>
                  <p className="mt-1 text-xs text-[var(--color-gray-600)]">
                    Day {a.days} · {formatKES(a.dailyRateKes)}/day accrued
                  </p>
                  <p className="mt-1 font-extrabold text-[var(--color-primary-dark)]">{formatKES(a.accruedKes)} accrued to date</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="eyebrow">Collections risk</p>
            <h2 className="mt-1 text-lg font-extrabold">Dormant accounts flagged</h2>
            <div className="mt-4 space-y-3">
              {dormant.length === 0 && <p className="text-sm text-[var(--color-gray-500)]">No dormant accounts with open balances.</p>}
              {dormant.map((d) => {
                const user = db.users.find((u) => u.id === d.userId);
                return (
                  <div key={d.userId} className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                    <p className="text-sm font-bold text-orange-900">{user?.fullName ?? 'Unknown'}</p>
                    <p className="mt-0.5 text-xs text-orange-700">{d.reason}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-orange-600">Flagged automatically · notify enabled</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Banknote; label: string; value: string; tone: 'green' | 'orange' | 'blue' }) {
  const tones = { green: 'bg-green-50 text-green-700', orange: 'bg-orange-50 text-orange-700', blue: 'bg-blue-50 text-blue-700' };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-gray-200)] bg-white p-4">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <div>
        <p className="text-xs text-[var(--color-gray-500)]">{label}</p>
        <p className="text-lg font-extrabold">{value}</p>
      </div>
    </div>
  );
}
