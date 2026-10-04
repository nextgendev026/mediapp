'use client';

import { Download, FileSpreadsheet, Loader2, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const ENTITIES: { value: string; label: string; phi: boolean }[] = [
  { value: 'users', label: 'Users & accounts', phi: true },
  { value: 'appointments', label: 'Appointments', phi: true },
  { value: 'encounters', label: 'Clinical encounters (SOAP)', phi: true },
  { value: 'prescriptions', label: 'Prescriptions', phi: true },
  { value: 'referrals', label: 'Referrals', phi: true },
  { value: 'invoices', label: 'Invoices', phi: false },
  { value: 'payments', label: 'Payments ledger', phi: false },
  { value: 'orders', label: 'Pharmacy orders', phi: true },
  { value: 'messages', label: 'Messages (metadata only)', phi: true },
  { value: 'audit', label: 'Audit log', phi: false },
  { value: 'admissions', label: 'Inpatient admissions', phi: true },
  { value: 'notifications', label: 'Notifications', phi: false }
];

function exportUrl(entity: string, format: string, from: string, to: string): string {
  const params = new URLSearchParams({ entity, format });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return `/api/admin/export?${params.toString()}`;
}

export function DataExport() {
  const [entity, setEntity] = useState('users');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [error, setError] = useState('');
  const [exported, setExported] = useState('');

  async function preview() {
    setLoadingCount(true);
    setError('');
    setCount(null);
    try {
      const res = await fetch(exportUrl(entity, format, from, to) + '&count=1', { credentials: 'same-origin' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Preview failed (${res.status})`);
      }
      const data = (await res.json()) as { count: number };
      setCount(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed.');
    } finally {
      setLoadingCount(false);
    }
  }

  function download() {
    const url = exportUrl(entity, format, from, to);
    window.location.href = url;
    setExported(`${entity} (${format.toUpperCase()})`);
    setTimeout(() => setExported(''), 5000);
  }

  const selected = ENTITIES.find((e) => e.value === entity);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="p-6">
        <p className="eyebrow">Export builder</p>
        <h2 className="mt-1 text-lg font-extrabold">Configure your download</h2>

        <div className="mt-5 space-y-5">
          <div>
            <label htmlFor="export-entity" className="text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">Dataset</label>
            <select
              id="export-entity"
              value={entity}
              onChange={(e) => { setEntity(e.target.value); setCount(null); }}
              className="mt-2 h-11 w-full rounded-lg border border-[var(--color-gray-200)] bg-white px-3 text-sm outline-none focus:border-[var(--color-primary)]"
            >
              {ENTITIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {selected?.phi && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-orange-700">
                <ShieldAlert className="h-3.5 w-3.5" />Contains personal health data
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="export-from" className="text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">From (date)</label>
              <input id="export-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[var(--color-gray-200)] bg-white px-3 text-sm outline-none focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label htmlFor="export-to" className="text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">To (date)</label>
              <input id="export-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[var(--color-gray-200)] bg-white px-3 text-sm outline-none focus:border-[var(--color-primary)]" />
            </div>
          </div>

          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">Format</legend>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition ${format === 'xlsx' ? 'border-green-600 bg-green-50 text-green-800' : 'border-[var(--color-gray-200)] bg-white text-[var(--color-gray-600)] hover:bg-[var(--color-gray-50)]'}`}
                aria-pressed={format === 'xlsx'}
              >
                <FileSpreadsheet className="h-4 w-4" />Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition ${format === 'csv' ? 'border-green-600 bg-green-50 text-green-800' : 'border-[var(--color-gray-200)] bg-white text-[var(--color-gray-600)] hover:bg-[var(--color-gray-50)]'}`}
                aria-pressed={format === 'csv'}
              >
                CSV (.csv)
              </button>
            </div>
          </fieldset>

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
          {exported && <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">Download started: {exported}</p>}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="secondary" onClick={preview} disabled={loadingCount} className="sm:w-40">
              {loadingCount ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Preview rows
            </Button>
            <Button type="button" onClick={download} className="sm:flex-1">
              <Download className="h-4 w-4" />Download {format.toUpperCase()}
            </Button>
          </div>

          {count !== null && (
            <p className="text-sm text-[var(--color-gray-600)]">
              <span className="font-extrabold">{count}</span> row{count === 1 ? '' : 's'} match the current filters.
            </p>
          )}
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="p-5">
          <p className="eyebrow">Compliance notice</p>
          <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--color-gray-600)]">
            <p>Exports may contain personal health information regulated under the Kenya Data Protection Act, 2019 and MOH record-keeping guidelines.</p>
            <p>Every export is written to the immutable audit trail with your user ID, timestamp, dataset, and date range.</p>
            <p>Store files encrypted, share only through approved channels, and delete when the purpose is fulfilled.</p>
          </div>
        </Card>
        <Card className="p-5">
          <p className="eyebrow">Formats</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="success">XLSX — Excel native</Badge>
            <Badge tone="neutral">CSV — universal</Badge>
            <Badge tone="warning">Encrypted message bodies excluded</Badge>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--color-gray-500)]">Message exports include metadata only (sender, timestamp, attachment flags) — encrypted contents never leave the participants&apos; devices.</p>
        </Card>
      </div>
    </div>
  );
}
