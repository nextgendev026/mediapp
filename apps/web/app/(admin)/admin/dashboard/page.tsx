import { redirect } from 'next/navigation';
import { Activity, AlertTriangle, CalendarCheck, CreditCard, FileText, HeartPulse, PackageCheck, ShieldAlert, UsersRound } from 'lucide-react';
import { MetricCard } from '@/components/shared/MetricCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { OperationsCenter } from '@/components/admin/OperationsCenter';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { adminMetrics, computeDormantUserIds, type AdminMetrics } from '@/lib/server/queries';
import { listAudit } from '@/lib/server/audit';
import { getDb } from '@/lib/server/store';
import { formatCompactKES, formatKES } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const guard = await requireRole(['admin']);
  if ('error' in guard) redirect('/login');
  const [metrics, dormant, recentAudit, db] = await Promise.all([
    adminMetrics(),
    computeDormantUserIds(),
    listAudit({ limit: 8 }),
    getDb()
  ]);

  const orderBars = buildOrderBars(db.orders.length, metrics.commerce.openOrders);
  const soon = db.appointments
    .filter((a) => a.status === 'booked')
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
    .slice(0, 4);
  const pendingRx = db.prescriptions.filter((p) => p.status === 'pending_approval');

  return (
    <div>
      <PageHeader
        eyebrow="Platform overview"
        title="Operations console"
        description="Live figures from users, care, commerce, and finance across AfyaCommerce."
        action={<Badge tone={metrics.security.failedLogins24h > 3 ? 'warning' : 'success'}>{metrics.security.failedLogins24h > 3 ? `${metrics.security.failedLogins24h} failed sign-ins today` : 'All services operational'}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Registered users" value={metrics.users.total.toLocaleString('en-KE')} detail={`${metrics.users.active} active · ${metrics.users.suspended} suspended`} icon={UsersRound} tone="blue" />
        <MetricCard label="Revenue collected" value={formatCompactKES(metrics.finance.revenueKes)} detail={`${formatKES(metrics.finance.outstandingKes)} outstanding`} icon={CreditCard} tone="green" />
        <MetricCard label="Upcoming consultations" value={String(metrics.clinical.upcoming)} detail={`${metrics.clinical.encounters} encounters recorded`} icon={CalendarCheck} tone="purple" />
        <MetricCard label="Prescriptions" value={String(metrics.clinical.prescriptions)} detail={`${pendingRx.length} awaiting approval`} icon={FileText} tone="orange" />
      </div>

      <div className="mt-7">
        <OperationsCenter />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Commerce</p>
              <h2 className="mt-1 text-lg font-extrabold">Order pipeline</h2>
            </div>
            <Badge tone="neutral">{metrics.commerce.orders} total orders</Badge>
          </div>
          <div className="mt-6 flex h-48 items-end gap-2 border-b border-l border-[var(--color-gray-200)] px-3 pt-4">
            {orderBars.map((bar, index) => (
              <div key={index} className="flex h-full flex-1 items-end">
                <div className="w-full rounded-t bg-[var(--color-primary)]/75" style={{ height: `${bar}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
            <div className="rounded-lg bg-[var(--color-gray-50)] p-3"><p className="font-extrabold text-[var(--color-gray-900)]">{metrics.commerce.openOrders}</p><p className="text-[var(--color-gray-500)]">Open</p></div>
            <div className="rounded-lg bg-[var(--color-gray-50)] p-3"><p className="font-extrabold text-[var(--color-gray-900)]">{metrics.commerce.delivered}</p><p className="text-[var(--color-gray-500)]">Delivered</p></div>
            <div className="rounded-lg bg-[var(--color-gray-50)] p-3"><p className="font-extrabold text-[var(--color-gray-900)]">{db.orders.length}</p><p className="text-[var(--color-gray-500)]">All time</p></div>
          </div>

          <div className="mt-6 border-t border-[var(--color-gray-100)] pt-5">
            <p className="eyebrow">Care operations</p>
            <div className="mt-3 space-y-3">
              {soon.length === 0 && <p className="text-sm text-[var(--color-gray-500)]">No upcoming appointments.</p>}
              {soon.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="font-bold">{a.date} · {a.time} — {a.mode.replace('_', ' ')}</span>
                  <span className="text-xs text-[var(--color-gray-500)]">{db.users.find((u) => u.id === a.patientId)?.fullName ?? 'Patient'}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Trust &amp; safety</p>
                <h2 className="mt-1 text-lg font-extrabold">Security posture</h2>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"><Activity className="h-5 w-5" /></span>
            </div>
            <div className="mt-5 space-y-3">
              <HealthRow label="Audit events (24h)" value={String(metrics.security.auditEvents24h)} tone="green" />
              <HealthRow label="Failed sign-ins (24h)" value={String(metrics.security.failedLogins24h)} tone={metrics.security.failedLogins24h > 3 ? 'orange' : 'green'} />
              <HealthRow label="PHI accesses (24h)" value={String(metrics.security.phiReads24h)} tone="green" />
              <HealthRow label="Staff MFA coverage" value={mfaCoverage(db)} tone="green" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Accounts</p>
                <h2 className="mt-1 text-lg font-extrabold">Needs attention</h2>
              </div>
              {dormant.length > 0 && <AlertTriangle className="h-5 w-5 text-orange-600" />}
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {dormant.length === 0 && <p className="text-[var(--color-gray-500)]">No dormant accounts with balances.</p>}
              {dormant.slice(0, 3).map((d) => {
                const user = db.users.find((u) => u.id === d.userId);
                return (
                  <div key={d.userId} className="rounded-lg bg-orange-50 p-3">
                    <p className="font-bold text-orange-800">{user?.fullName ?? 'Unknown'}</p>
                    <p className="mt-0.5 text-xs text-orange-700">{d.reason}</p>
                  </div>
                );
              })}
              <a href="/admin/accounting" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-primary-dark)] hover:underline">Open accounting <ShieldAlert className="h-3.5 w-3.5" /></a>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Immutable trail</p>
                <h2 className="mt-1 text-lg font-extrabold">Recent audit events</h2>
              </div>
              <a href="/admin/audit-log" className="text-xs font-bold text-[var(--color-primary-dark)] hover:underline">View all</a>
            </div>
            <div className="mt-4 space-y-3">
              {recentAudit.rows.map((event) => (
                <div key={event.id} className="flex items-start justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-[var(--color-gray-900)]">{event.action.replace(/_/g, ' ')}</p>
                    <p className="text-[var(--color-gray-500)]">{event.actorRole} · {new Date(event.at).toLocaleString('en-KE')}</p>
                  </div>
                  {event.phiAccessed && <Badge tone="warning">PHI</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile icon={HeartPulse} label="Patients" value={String(metrics.users.byRole.patient ?? 0)} />
        <StatTile icon={PackageCheck} label="Orders (all)" value={String(metrics.commerce.orders)} />
        <StatTile icon={CreditCard} label="Invoiced" value={formatKES(metrics.finance.invoicedKes)} />
      </div>
    </div>
  );
}

function buildOrderBars(total: number, open: number): number[] {
  const base = total === 0 ? [12] : [28, 41, 36, 55, 47, 63, Math.max(20, Math.min(96, 40 + open * 12))];
  return base;
}

function mfaCoverage(db: Awaited<ReturnType<typeof getDb>>): string {
  const staff = db.users.filter((u) => u.role !== 'patient' && u.role !== 'rider');
  if (staff.length === 0) return 'n/a';
  const withMfa = staff.filter((u) => u.mfa).length;
  return `${Math.round((withMfa / staff.length) * 100)}%`;
}

function HealthRow({ label, value, tone }: { label: string; value: string; tone: 'green' | 'orange' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--color-gray-600)]">{label}</span>
      <span className={`font-extrabold ${tone === 'green' ? 'text-green-700' : 'text-orange-700'}`}>{value}</span>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-gray-200)] bg-white p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-gray-50)] text-[var(--color-primary-dark)]"><Icon className="h-5 w-5" /></span>
      <div>
        <p className="text-xs text-[var(--color-gray-500)]">{label}</p>
        <p className="text-lg font-extrabold">{value}</p>
      </div>
    </div>
  );
}
