'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface AuditRow {
  id: string;
  at: string;
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  purpose?: string;
  phiAccessed: boolean;
  ip?: string;
}

const ROLES = ['patient', 'provider', 'pharmacist', 'admin', 'rider'];

export function AuditViewer() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (role) params.set('role', role);
      if (action) params.set('action', action);
      params.set('limit', '300');
      const res = await fetch(`/api/admin/audit?${params.toString()}`, { headers: { 'X-Afya-Client': 'web' } });
      if (!res.ok) throw new Error('Could not load audit log.');
      const data = (await res.json()) as { rows: AuditRow[]; total: number };
      setRows(data.rows);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load audit log.');
    } finally {
      setLoading(false);
    }
  }, [q, role, action]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    params.set('export', 'csv');
    window.location.href = `/api/admin/audit?${params.toString()}`;
  }

  const actions = Array.from(new Set(rows.map((r) => r.action))).sort();

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="audit-search" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gray-400)]" aria-hidden="true" />
            <Input id="audit-search" placeholder="Action, resource, purpose…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div>
          <label htmlFor="audit-role" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Actor role</label>
          <Select id="audit-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </div>
        <div>
          <label htmlFor="audit-action" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Action</label>
          <Select id="audit-action" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
        <Button type="button" variant="outline" onClick={exportCsv}><Download className="h-4 w-4" />Export CSV</Button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b border-[var(--color-gray-200)] bg-[var(--color-gray-50)] text-xs uppercase tracking-wide text-[var(--color-gray-500)]">
            <tr>
              <th className="px-4 py-3 font-bold">Time</th>
              <th className="px-4 py-3 font-bold">Actor</th>
              <th className="px-4 py-3 font-bold">Action</th>
              <th className="px-4 py-3 font-bold">Resource</th>
              <th className="px-4 py-3 font-bold">Purpose</th>
              <th className="px-4 py-3 font-bold">PHI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-gray-100)]">
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--color-gray-500)]">Loading audit trail…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--color-gray-500)]">No audit events match these filters.</td></tr>}
            {!loading && rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 text-xs text-[var(--color-gray-600)]">{new Date(row.at).toLocaleString('en-KE')}</td>
                <td className="px-4 py-3"><Badge tone="neutral">{row.actorRole}</Badge></td>
                <td className="px-4 py-3 font-bold">{row.action.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-xs text-[var(--color-gray-600)]">{row.resourceType}{row.resourceId ? ` · ${row.resourceId.slice(0, 8)}` : ''}</td>
                <td className="px-4 py-3 text-xs text-[var(--color-gray-500)]">{row.purpose ?? '—'}</td>
                <td className="px-4 py-3">{row.phiAccessed ? <Badge tone="warning">PHI</Badge> : <span className="text-xs text-[var(--color-gray-400)]">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--color-gray-500)]">{total} events · exports are themselves audited</p>
    </Card>
  );
}
