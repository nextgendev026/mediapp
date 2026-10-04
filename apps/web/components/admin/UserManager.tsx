'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Eye, Plus, RefreshCw, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone: string;
  status: 'active' | 'suspended';
  mfa: boolean;
  createdAt: string;
  lastLoginAt?: string;
  county?: string;
  specialty?: string;
}

interface UserDetail extends PublicUser {
  appointments: { id: string; date: string; time: string; status: string; provider: string; reason: string }[];
  orders: { id: string; number: string; createdAt: string; totalKes: number; status: string }[];
  invoices: { id: string; number: string; issuedAt: string; totalKes: number; paidKes: number; status: string }[];
  recentAudit: { id: string; at: string; action: string; resourceType: string; purpose?: string; phiAccessed: boolean }[];
}

const ROLES = ['patient', 'provider', 'pharmacist', 'admin', 'rider'];

export function UserManager({ viewerId }: { viewerId: string }) {
  const [rows, setRows] = useState<PublicUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (role) params.set('role', role);
      if (status) params.set('status', status);
      params.set('page', String(page));
      const res = await fetch(`/api/admin/users?${params.toString()}`, { headers: { 'X-Afya-Client': 'web' } });
      if (!res.ok) throw new Error('Could not load users.');
      const data = (await res.json()) as { rows: PublicUser[]; total: number; page: number; pageCount: number };
      setRows(data.rows);
      setTotal(data.total);
      setPage(data.page);
      setPageCount(data.pageCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, [q, role, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchUser(id: string, body: Record<string, string>) {
    setNotice('');
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify(body)
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Update failed.');
      setNotice('Account updated. The change was written to the audit log.');
      await load();
      if (detail?.id === id) {
        const d = await fetch(`/api/admin/users/${id}`, { headers: { 'X-Afya-Client': 'web' } });
        if (d.ok) setDetail(((await d.json()) as { user: UserDetail }).user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  }

  async function openDetail(id: string) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, { headers: { 'X-Afya-Client': 'web' } });
      if (!res.ok) throw new Error('Could not load user.');
      setDetail(((await res.json()) as { user: UserDetail }).user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load user.');
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <ShieldCheck className="h-5 w-5 shrink-0" />
        Every role change, suspension, and creation is recorded in the immutable audit log.
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="user-search" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Search</label>
            <Input id="user-search" placeholder="Name, email, phone, county…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label htmlFor="user-role" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Role</label>
            <Select id="user-role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          <div>
            <label htmlFor="user-status" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Status</label>
            <Select id="user-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
          <Button type="button" onClick={() => setCreateOpen((v) => !v)}><Plus className="h-4 w-4" />New account</Button>
        </div>

        {createOpen && <CreateUserForm onCreated={() => { setCreateOpen(false); void load(); }} />}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">{notice}</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[var(--color-gray-200)] bg-[var(--color-gray-50)] text-xs uppercase tracking-wide text-[var(--color-gray-500)]">
              <tr>
                <th className="px-4 py-3 font-bold">User</th>
                <th className="px-4 py-3 font-bold">Role</th>
                <th className="px-4 py-3 font-bold">MFA</th>
                <th className="px-4 py-3 font-bold">Last activity</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-gray-100)]">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--color-gray-500)]">Loading accounts…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--color-gray-500)]">No accounts match these filters.</td></tr>
              )}
              {!loading && rows.map((user) => (
                <tr key={user.id} className="hover:bg-[var(--color-gray-50)]">
                  <td className="px-4 py-3">
                    <p className="font-bold">{user.fullName}</p>
                    <p className="text-xs text-[var(--color-gray-500)]">{user.email} · {user.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      aria-label={`Role for ${user.fullName}`}
                      value={user.role}
                      disabled={user.id === viewerId}
                      onChange={(e) => void patchUser(user.id, { role: e.target.value })}
                      className="min-h-9 py-1 text-xs"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    {user.mfa
                      ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700"><UserCheck className="h-4 w-4" />Enabled</span>
                      : <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700"><UserX className="h-4 w-4" />Not set</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-gray-500)]">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-KE') : 'Never'}
                  </td>
                  <td className="px-4 py-3"><Badge tone={user.status === 'active' ? 'success' : 'warning'}>{user.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => void openDetail(user.id)}><Eye className="h-3.5 w-3.5" />View</Button>
                      {user.id !== viewerId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void patchUser(user.id, { status: user.status === 'active' ? 'suspended' : 'active' })}
                        >
                          {user.status === 'active' ? 'Suspend' : 'Activate'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-gray-600)]">
          <span>{total} accounts</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" />Prev</Button>
            <span className="text-xs">Page {page} of {pageCount}</span>
            <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next<ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>

      {detail && <UserDetailPanel detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', role: 'patient', password: '', county: '', specialty: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify(form)
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not create account.');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string, type = 'text', placeholder = '') => (
    <div>
      <label htmlFor={`create-${key}`} className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">{label}</label>
      <Input id={`create-${key}`} type={type} placeholder={placeholder} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-4 sm:grid-cols-2 lg:grid-cols-3">
      {field('fullName', 'Full name')}
      {field('email', 'Email', 'email')}
      {field('phone', 'Phone', 'tel', '07XX XXX XXX')}
      <div>
        <label htmlFor="create-role" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Role</label>
        <Select id="create-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      </div>
      {field('password', 'Temporary password', 'password', 'min 8 characters')}
      {field('county', 'County')}
      {form.role === 'provider' && field('specialty', 'Specialty')}
      {error && <p role="alert" className="sm:col-span-2 lg:col-span-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
      </div>
    </form>
  );
}

function UserDetailPanel({ detail, onClose }: { detail: UserDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Account detail</p>
            <h2 className="mt-1 text-2xl font-extrabold">{detail.fullName}</h2>
            <p className="mt-1 text-sm text-[var(--color-gray-500)]">{detail.email} · {detail.phone} · joined {new Date(detail.createdAt).toLocaleDateString('en-KE')}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone="neutral">{detail.role}</Badge>
          <Badge tone={detail.status === 'active' ? 'success' : 'warning'}>{detail.status}</Badge>
          {detail.mfa && <Badge tone="success">MFA</Badge>}
          {detail.county && <Badge tone="neutral">{detail.county}</Badge>}
          {detail.specialty && <Badge tone="neutral">{detail.specialty}</Badge>}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <DetailSection title="Appointments">
            {detail.appointments.length === 0 && <Empty text="No appointments." />}
            {detail.appointments.map((a) => (
              <p key={a.id} className="text-sm"><span className="font-bold">{a.date} {a.time}</span> — {a.reason} <span className="text-xs text-[var(--color-gray-500)]">({a.status})</span></p>
            ))}
          </DetailSection>
          <DetailSection title="Orders">
            {detail.orders.length === 0 && <Empty text="No orders." />}
            {detail.orders.map((o) => (
              <p key={o.id} className="text-sm"><span className="font-bold">{o.number}</span> — Ksh {o.totalKes.toLocaleString('en-KE')} <span className="text-xs text-[var(--color-gray-500)]">({o.status})</span></p>
            ))}
          </DetailSection>
          <DetailSection title="Invoices">
            {detail.invoices.length === 0 && <Empty text="No invoices." />}
            {detail.invoices.map((i) => (
              <p key={i.id} className="text-sm"><a className="font-bold text-[var(--color-primary-dark)] hover:underline" href={`/invoice/${i.id}`}>{i.number}</a> — Ksh {i.totalKes.toLocaleString('en-KE')} paid {i.paidKes.toLocaleString('en-KE')} <span className="text-xs text-[var(--color-gray-500)]">({i.status})</span></p>
            ))}
          </DetailSection>
          <DetailSection title="Recent activity">
            {detail.recentAudit.length === 0 && <Empty text="No recorded activity." />}
            {detail.recentAudit.map((a) => (
              <p key={a.id} className="text-sm"><span className="font-bold">{a.action.replace(/_/g, ' ')}</span> <span className="text-xs text-[var(--color-gray-500)]">{a.resourceType} · {new Date(a.at).toLocaleString('en-KE')}{a.phiAccessed ? ' · PHI' : ''}</span></p>
            ))}
          </DetailSection>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-gray-200)] p-4">
      <h3 className="text-sm font-extrabold">{title}</h3>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-[var(--color-gray-500)]">{text}</p>;
}
