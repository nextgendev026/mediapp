'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, RefreshCw, Search, UserPlus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { STAGE_LABELS, STAGE_SHORT_LABELS, STAGE_TONES, VISIT_STAGES, nextStage, type VisitStage } from '@/lib/workflow';

interface InvoiceBadge {
  number: string;
  status: string;
  balance: number;
}

interface VisitRow {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  providerId: string;
  providerName: string;
  assignedTo?: string | undefined;
  assignedToName: string;
  date: string;
  time: string;
  mode: string;
  status: string;
  reason: string;
  feeKes: number;
  stage: VisitStage;
  openLabs: number;
  invoice: InvoiceBadge | null;
}

interface ProviderOption {
  id: string;
  fullName: string;
  specialty: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function WorkflowBoard() {
  const [date, setDate] = useState<string>(() => todayIso());
  const [query, setQuery] = useState('');
  const [mobileStage, setMobileStage] = useState<VisitStage>('front_desk');
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [intakeOpen, setIntakeOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      else params.set('scope', 'all');
      const res = await fetch(`/api/visits?${params.toString()}`, { headers: { 'X-Afya-Client': 'web' } });
      if (!res.ok) throw new Error('Could not load the workflow board.');
      const data = (await res.json()) as { visits: VisitRow[] };
      setRows(data.visits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the workflow board.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/providers', { headers: { 'X-Afya-Client': 'web' } });
        if (!res.ok) return;
        const data = (await res.json()) as { providers: ProviderOption[] };
        if (!cancelled) setProviders(data.providers);
      } catch {
        if (!cancelled) setProviders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const search = query.trim().toLowerCase();
  const visible = useMemo(
    () => rows.filter((r) => !search || r.patientName.toLowerCase().includes(search) || r.phone.includes(search)),
    [rows, search]
  );
  const counts = useMemo(() => {
    const map = new Map<VisitStage, number>();
    for (const stage of VISIT_STAGES) map.set(stage, 0);
    for (const row of rows) map.set(row.stage, (map.get(row.stage) ?? 0) + 1);
    return map;
  }, [rows]);
  const mobileRows = visible.filter((r) => r.stage === mobileStage);

  async function patchVisit(id: string, payload: Record<string, string>, successMessage: string) {
    setNotice('');
    setError('');
    try {
      const res = await fetch(`/api/visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Update failed.');
      setNotice(successMessage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  }

  function assign(visitId: string, providerId: string, name: string) {
    if (!providerId) return;
    void patchVisit(visitId, { assignedTo: providerId }, `Assigned to ${name}.`);
  }

  function advance(row: VisitRow) {
    const next = nextStage(row.stage);
    if (!next) return;
    void patchVisit(row.id, { stage: next }, `${row.patientName} moved to ${STAGE_LABELS[next]}.`);
  }

  return (
    <div>
      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="-mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-1">
            {VISIT_STAGES.map((stage) => (
              <div key={stage} className="min-w-[96px] shrink-0 rounded-lg border border-[var(--color-gray-200)] bg-white px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-gray-500)]">{STAGE_SHORT_LABELS[stage]}</p>
                <p className="mt-0.5 text-xl font-extrabold leading-6">{counts.get(stage) ?? 0}</p>
              </div>
            ))}
          </div>
          <Button type="button" onClick={() => setIntakeOpen(true)} className="shrink-0">
            <UserPlus className="h-4 w-4" />
            Walk-in intake
          </Button>
        </div>
      </Card>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="wf-date" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Date</label>
            <Input id="wf-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          </div>
          <div className="min-w-[200px] flex-1">
            <label htmlFor="wf-search" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Search patient</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gray-400)]" />
              <Input id="wf-search" placeholder="Name or phone…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="lg:hidden">
            <label htmlFor="wf-stage" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Stage</label>
            <Select id="wf-stage" value={mobileStage} onChange={(e) => setMobileStage(e.target.value as VisitStage)}>
              {VISIT_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]} ({counts.get(stage) ?? 0})
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()} aria-label="Refresh board">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" onClick={() => setDate('')}>
            All dates
          </Button>
        </div>
        {notice && <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">{notice}</p>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        {loading && <p className="mt-3 text-xs font-semibold text-[var(--color-gray-500)]">Loading visits…</p>}
      </Card>

      <div className="space-y-3 lg:hidden">
        {mobileRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--color-gray-300)] p-6 text-center text-sm font-semibold text-[var(--color-gray-500)]">
            No visits in {STAGE_LABELS[mobileStage]} right now.
          </p>
        ) : (
          mobileRows.map((row) => (
            <VisitCard key={row.id} row={row} providers={providers} onAssign={assign} onAdvance={advance} />
          ))
        )}
      </div>

      <div className="hidden gap-3 overflow-x-auto pb-4 lg:flex">
        {VISIT_STAGES.map((stage) => {
          const stageRows = visible.filter((r) => r.stage === stage);
          return (
            <section
              key={stage}
              className="w-[260px] min-w-[240px] shrink-0 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold">{STAGE_LABELS[stage]}</h2>
                <Badge tone={STAGE_TONES[stage]}>{stageRows.length}</Badge>
              </div>
              <div className="space-y-3">
                {stageRows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[var(--color-gray-300)] p-3 text-center text-xs font-semibold text-[var(--color-gray-400)]">
                    Empty
                  </p>
                ) : (
                  stageRows.map((row) => (
                    <VisitCard key={row.id} row={row} providers={providers} onAssign={assign} onAdvance={advance} />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {intakeOpen && (
        <IntakeModal
          providers={providers}
          onClose={() => setIntakeOpen(false)}
          onCreated={(message) => {
            setIntakeOpen(false);
            setNotice(message);
            void load();
          }}
        />
      )}
    </div>
  );
}

function VisitCard({
  row,
  providers,
  onAssign,
  onAdvance
}: {
  row: VisitRow;
  providers: ProviderOption[];
  onAssign: (visitId: string, providerId: string, name: string) => void;
  onAdvance: (row: VisitRow) => void;
}) {
  const canAdvance = nextStage(row.stage) !== null;
  return (
    <article className="rounded-xl border border-[var(--color-gray-200)] bg-white p-3 shadow-[var(--shadow-card,0_1px_2px_rgba(16,24,40,0.06))]">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-extrabold">{row.patientName}</p>
        <span className="shrink-0 text-xs font-bold text-[var(--color-gray-500)]">{row.time}</span>
      </div>
      <p className="mt-0.5 truncate text-xs text-[var(--color-gray-500)]">
        {row.phone} · {row.mode.replace('_', ' ')}
      </p>
      <p className={`mt-1 text-xs font-bold ${row.assignedToName ? 'text-[var(--color-gray-700)]' : 'text-amber-600'}`}>
        {row.assignedToName || 'Unassigned'}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-gray-600)]">{row.reason}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone="neutral">{row.date.slice(5)}</Badge>
        {row.openLabs > 0 && <Badge tone="info">Labs {row.openLabs}</Badge>}
        {row.invoice &&
          (row.invoice.balance <= 0 || row.invoice.status === 'paid' ? (
            <Badge tone="success">Paid</Badge>
          ) : (
            <Badge tone="warning">Unpaid Ksh {row.invoice.balance}</Badge>
          ))}
      </div>
      <div className="mt-3 space-y-2">
        <Select
          aria-label={`Assign clinician for ${row.patientName}`}
          value={row.assignedTo ?? ''}
          onChange={(e) => onAssign(row.id, e.target.value, providers.find((p) => p.id === e.target.value)?.fullName ?? 'clinician')}
          className="min-h-9 px-2 py-1.5 text-xs"
        >
          <option value="">Assign clinician…</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.fullName}
            </option>
          ))}
        </Select>
        <Button type="button" size="sm" variant="outline" className="w-full" disabled={!canAdvance} onClick={() => onAdvance(row)}>
          Advance
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-[var(--color-gray-400)]">Room opened by clinician</p>
    </article>
  );
}

function IntakeModal({
  providers,
  onClose,
  onCreated
}: {
  providers: ProviderOption[];
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [reason, setReason] = useState('');
  const [providerId, setProviderId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!/^(\+254|0)[17]\d{8}$/.test(phone.trim())) {
      setError('Enter a valid Kenyan phone number, e.g. 0712345678.');
      return;
    }
    if (reason.trim().length < 5) {
      setError('Describe the reason in at least 5 characters.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify({ patientName: patientName.trim(), phone: phone.trim(), gender, reason: reason.trim(), providerId })
      });
      const data = (await res.json()) as { error?: string; patient?: { fullName: string } };
      if (!res.ok) throw new Error(data.error || 'Intake failed.');
      onCreated(`${data.patient?.fullName ?? 'Patient'} added to the front desk queue.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Intake failed.');
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Walk-in intake">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Front desk</p>
            <h2 className="mt-1 text-xl font-extrabold">Walk-in intake</h2>
            <p className="mt-1 text-sm text-[var(--color-gray-500)]">Register a walk-in (or match an existing patient by phone) and place them on the board.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close intake" className="rounded-lg p-2 text-[var(--color-gray-500)] hover:bg-[var(--color-gray-100)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="intake-name" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Patient name</label>
            <Input id="intake-name" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Full name (leave blank if known patient)" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="intake-phone" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Phone</label>
              <Input id="intake-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712345678" inputMode="tel" required />
            </div>
            <div>
              <label htmlFor="intake-gender" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Gender</label>
              <Select id="intake-gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Not specified</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </Select>
            </div>
          </div>
          <div>
            <label htmlFor="intake-reason" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Reason for visit</label>
            <Textarea id="intake-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Headache and fever since Monday" required />
          </div>
          <div>
            <label htmlFor="intake-clinician" className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">Clinician (optional)</label>
            <Select id="intake-clinician" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              <option value="">Default clinician</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.fullName} — {provider.specialty}
                </option>
              ))}
            </Select>
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              <UserPlus className="h-4 w-4" />
              {busy ? 'Adding…' : 'Add to front desk'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
