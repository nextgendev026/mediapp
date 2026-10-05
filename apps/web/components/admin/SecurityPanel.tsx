'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Ban, KeyRound, Lock, RefreshCw, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Block {
  target: string;
  kind: 'ip' | 'account';
  reason: string;
  severity: string;
  expiresAt: string | null;
  auto: boolean;
}

interface SecurityEvent {
  id: string;
  at: string;
  type: string;
  severity: string;
  ip: string | null;
  account_id: string | null;
  action_taken: string | null;
}

interface SecurityStatus {
  lockdown: boolean;
  lockdownRemainingMs: number;
  activeBlocks: Block[];
  recentEvents: SecurityEvent[];
  threatLevel: 'normal' | 'elevated' | 'high' | 'critical';
}

const THREAT_STYLES: Record<SecurityStatus['threatLevel'], string> = {
  normal: 'bg-emerald-100 text-emerald-800',
  elevated: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

export function SecurityPanel() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/security');
      if (!res.ok) throw new Error('Failed to load security status.');
      setStatus(await res.json());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, target?: string) {
    setActing(true);
    setError('');
    try {
      const res = await fetch('/api/admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify({ action, target })
      });
      if (!res.ok) throw new Error('Action failed.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading security status…
      </div>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-slate-500">
          Security status unavailable. Ensure Supabase is configured.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Threat level</CardDescription>
            <CardTitle className="text-2xl">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${THREAT_STYLES[status.threatLevel]}`}>
                {status.threatLevel === 'critical' ? <ShieldAlert className="mr-1 h-4 w-4" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
                {status.threatLevel.toUpperCase()}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lockdown</CardDescription>
            <CardTitle className="text-2xl">
              {status.lockdown ? (
                <span className="inline-flex items-center text-red-600"><Lock className="mr-1 h-5 w-5" /> ACTIVE</span>
              ) : (
                <span className="text-emerald-600">Inactive</span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active blocks</CardDescription>
            <CardTitle className="text-2xl">{status.activeBlocks.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recent events</CardDescription>
            <CardTitle className="text-2xl">{status.recentEvents.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Self-healing actions</CardTitle>
          <CardDescription>Automatic remediation runs continuously. Use these for manual control.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => act('rotate_key')} disabled={acting}>
            <KeyRound className="mr-2 h-4 w-4" /> Rotate session key
          </Button>
          <Button variant="destructive" onClick={() => act('lockdown')} disabled={acting || status.lockdown}>
            <AlertTriangle className="mr-2 h-4 w-4" /> Trigger lockdown
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={acting}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Ban className="h-5 w-5" /> Active blocks</CardTitle>
          <CardDescription>IPs and accounts automatically blocked by the security system.</CardDescription>
        </CardHeader>
        <CardContent>
          {status.activeBlocks.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No active blocks.</p>
          ) : (
            <div className="divide-y">
              {status.activeBlocks.map((block) => (
                <div key={`${block.kind}-${block.target}`} className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{block.kind}</span>
                      <span className="font-mono text-sm">{block.target}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[block.severity] ?? SEVERITY_STYLES.low}`}>{block.severity}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {block.reason} {block.expiresAt ? `· expires ${new Date(block.expiresAt).toLocaleString()}` : '· permanent'} {block.auto ? '· auto' : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => act('unblock', block.target)} disabled={acting}>
                    <Trash2 className="mr-1 h-4 w-4" /> Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent security events</CardTitle>
          <CardDescription>Latest detected threats and auto-mend actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {status.recentEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No security events recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Severity</th>
                    <th className="py-2 pr-4">IP</th>
                    <th className="py-2 pr-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {status.recentEvents.map((event) => (
                    <tr key={event.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-slate-600">{new Date(event.at).toLocaleString()}</td>
                      <td className="py-2 pr-4 font-medium">{event.type}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[event.severity] ?? SEVERITY_STYLES.low}`}>{event.severity}</span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{event.ip ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-600">{event.action_taken ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
