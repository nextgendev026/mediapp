import { redirect } from 'next/navigation';
import { Database, KeyRound, Server, ShieldCheck, Wifi } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { requireRole } from '@/lib/server/guard';
import { listAudit } from '@/lib/server/audit';
import { getDb } from '@/lib/server/store';

export const dynamic = 'force-dynamic';

function integrationStatus(): { name: string; state: 'ok' | 'degraded' | 'off'; note: string }[] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseOn = Boolean(supabaseUrl) && !/example\.|replace-with/i.test(supabaseUrl);
  const mpesaBase = process.env.NEXT_PUBLIC_MPESA_API_BASE ?? '';
  return [
    { name: 'Supabase (auth + data)', state: supabaseOn ? 'ok' : 'off', note: supabaseOn ? 'Connected' : 'Placeholder credentials — local store in use' },
    { name: 'Demo session store', state: 'ok', note: 'HMAC-signed httpOnly cookies, 12h expiry' },
    { name: 'M-PESA gateway', state: mpesaBase && !/example\./.test(mpesaBase) ? 'ok' : 'degraded', note: mpesaBase ? 'Sandbox endpoint configured' : 'No gateway configured' },
    { name: 'Web Push (VAPID)', state: 'off', note: 'In-app + browser notifications active; remote push not provisioned' }
  ];
}

export default async function MonitoringPage() {
  const guard = await requireRole(['admin']);
  if ('error' in guard) redirect('/login');

  const db = await getDb();
  const authEvents = await listAudit({ action: 'auth_login_failed', limit: 20 });
  const recentAuth = (await listAudit({ limit: 40 })).rows.filter((a) => a.action.startsWith('auth_'));
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  const stats = [
    { label: 'Users', value: db.users.length },
    { label: 'Appointments', value: db.appointments.length },
    { label: 'Encounters', value: db.encounters.length },
    { label: 'Prescriptions', value: db.prescriptions.length },
    { label: 'Referrals', value: db.referrals.length },
    { label: 'Threads', value: db.threads.length },
    { label: 'Messages', value: db.messages.length },
    { label: 'Invoices', value: db.invoices.length },
    { label: 'Payments', value: db.payments.length },
    { label: 'Orders', value: db.orders.length },
    { label: 'Audit events', value: db.audit.length },
    { label: 'Notifications', value: db.notifications.length }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Observability"
        title="Monitoring"
        description="Store health, integration status, and authentication telemetry."
        action={<Badge tone="success"><Wifi className="h-3.5 w-3.5" />Live</Badge>}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-[var(--color-primary-dark)]" />
            <h2 className="text-lg font-extrabold">Integrations</h2>
          </div>
          <div className="mt-4 space-y-3">
            {integrationStatus().map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-lg border border-[var(--color-gray-200)] p-3">
                <div>
                  <p className="text-sm font-bold">{item.name}</p>
                  <p className="text-xs text-[var(--color-gray-500)]">{item.note}</p>
                </div>
                <Badge tone={item.state === 'ok' ? 'success' : item.state === 'degraded' ? 'warning' : 'neutral'}>{item.state}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[var(--color-primary-dark)]" />
            <h2 className="text-lg font-extrabold">Authentication telemetry</h2>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-[var(--color-gray-50)] p-3">
              <p className="text-lg font-extrabold">{recentAuth.filter((a) => a.action === 'auth_login' && a.at >= dayAgo).length}</p>
              <p className="text-xs text-[var(--color-gray-500)]">Logins (24h)</p>
            </div>
            <div className="rounded-lg bg-[var(--color-gray-50)] p-3">
              <p className={`text-lg font-extrabold ${authEvents.rows.length > 0 ? 'text-orange-700' : ''}`}>{authEvents.rows.filter((a) => a.at >= dayAgo).length}</p>
              <p className="text-xs text-[var(--color-gray-500)]">Failures (24h)</p>
            </div>
            <div className="rounded-lg bg-[var(--color-gray-50)] p-3">
              <p className="text-lg font-extrabold">{db.users.filter((u) => u.mfa).length}</p>
              <p className="text-xs text-[var(--color-gray-500)]">MFA enabled</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 border-t border-[var(--color-gray-100)] pt-4">
            {recentAuth.slice(0, 8).map((event) => (
              <div key={event.id} className="flex items-center justify-between text-xs">
                <span className="font-bold">{event.action.replace(/_/g, ' ')}</span>
                <span className="text-[var(--color-gray-500)]">{event.actorRole} · {new Date(event.at).toLocaleString('en-KE')}</span>
              </div>
            ))}
            {recentAuth.length === 0 && <p className="text-sm text-[var(--color-gray-500)]">No auth events recorded.</p>}
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-[var(--color-primary-dark)]" />
            <h2 className="text-lg font-extrabold">Local store collections</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-[var(--color-gray-200)] p-3 text-center">
                <p className="text-xl font-extrabold">{s.value}</p>
                <p className="text-xs text-[var(--color-gray-500)]">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-green-800">
        <ShieldCheck className="h-5 w-5 shrink-0" />
        <p>Session cookies are httpOnly + SameSite. Login is rate-limited to 8 attempts/minute/IP. Mutations enforce same-origin. PHI reads are written to the audit trail.</p>
      </div>
    </div>
  );
}
