'use client';

import { AlertTriangle, Check, FileText, ShieldCheck, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface RxItemView {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
}

export interface RxView {
  id: string;
  date: string;
  status: 'pending_approval' | 'approved' | 'dispensed' | 'rejected';
  patientName: string;
  patientPhone: string;
  providerName: string;
  items: RxItemView[];
  notes?: string | undefined;
  signedByName?: string | undefined;
}

export interface RxSummary {
  pending: number;
  approved: number;
  dispensedToday: number;
}

type FilterKey = 'pending_approval' | 'approved' | 'dispensed' | 'rejected' | 'all';
type PatchStatus = 'approved' | 'rejected' | 'dispensed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'pending_approval', label: 'Pending review' },
  { key: 'approved', label: 'Approved' },
  { key: 'dispensed', label: 'Dispensed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' }
];

const STATUS_BADGE: Record<RxView['status'], { label: string; tone: 'warning' | 'success' | 'neutral' | 'error' }> = {
  pending_approval: { label: 'Pending review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  dispensed: { label: 'Dispensed', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'error' }
};

export function RxQueue({ rows, summary }: { rows: RxView[]; summary: RxSummary }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('pending_approval');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ id: string; action: PatchStatus } | null>(null);
  const [noteText, setNoteText] = useState('');

  const counts: Record<FilterKey, number> = {
    pending_approval: rows.filter((row) => row.status === 'pending_approval').length,
    approved: rows.filter((row) => row.status === 'approved').length,
    dispensed: rows.filter((row) => row.status === 'dispensed').length,
    rejected: rows.filter((row) => row.status === 'rejected').length,
    all: rows.length
  };

  const visible = filter === 'all' ? rows : rows.filter((row) => row.status === filter);

  async function patch(id: string, status: PatchStatus, notes?: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/prescriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify(notes ? { status, notes } : { status })
      });
      if (!res.ok) {
        let message = `Request failed (${res.status}).`;
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (data && typeof data.error === 'string' && data.error) message = data.error;
        setError(message);
        return;
      }
      setNoteDraft(null);
      setNoteText('');
      router.refresh();
    } catch {
      setError('We could not reach the server. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  function startNote(id: string, action: PatchStatus) {
    setError(null);
    setNoteDraft({ id, action });
    setNoteText('');
  }

  return (
    <div>
      <Card className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`min-h-11 rounded-lg px-3 text-xs font-bold transition ${
                filter === item.key
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]'
                  : 'border border-[var(--color-gray-200)] bg-white text-[var(--color-gray-600)]'
              }`}
              aria-pressed={filter === item.key}
            >
              {item.label}
              <span className="ml-1.5">{counts[item.key]}</span>
            </button>
          ))}
        </div>
        <p className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-gray-500)]">
          <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" />
          Verify patient identity before dispensing.
        </p>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold text-amber-800">Pending review</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-900">{summary.pending}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-bold text-green-800">Approved, ready to dispense</p>
          <p className="mt-1 text-2xl font-extrabold text-green-900">{summary.approved}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-4">
          <p className="text-xs font-bold text-[var(--color-gray-600)]">Dispensed today</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--color-gray-900)]">{summary.dispensedToday}</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-red-800">Action failed</p>
            <p className="mt-1 break-words text-sm text-red-700">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-100" aria-label="Dismiss error">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title="No prescriptions in this view"
          description="Switch filters to see other prescriptions in the dispensing queue."
          icon={FileText}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((rx) => {
            const badge = STATUS_BADGE[rx.status];
            const draft = noteDraft && noteDraft.id === rx.id ? noteDraft : null;
            const busy = busyId === rx.id;
            return (
              <Card key={rx.id} className="p-0">
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-extrabold">{rx.patientName}</p>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                      <span className="font-mono text-xs text-[var(--color-gray-500)]">{rx.date}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-gray-500)]">
                      {rx.patientPhone} · Prescribed by {rx.providerName}
                    </p>

                    <ul className="mt-3 space-y-2 rounded-xl bg-[var(--color-gray-50)] p-3">
                      {rx.items.map((item, index) => (
                        <li key={`${rx.id}-${index}`} className="text-sm">
                          <p className="font-bold text-[var(--color-gray-900)]">{item.name}</p>
                          <p className="mt-0.5 text-xs text-[var(--color-gray-600)]">
                            {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' — ')} · qty x{item.quantity}
                          </p>
                          {item.instructions && <p className="mt-0.5 text-xs text-[var(--color-gray-500)]">{item.instructions}</p>}
                        </li>
                      ))}
                    </ul>

                    {rx.notes && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Prescription notes</p>
                        <p className="mt-1 text-sm leading-6 text-amber-900">{rx.notes}</p>
                      </div>
                    )}

                    {rx.status === 'dispensed' && (
                      <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-gray-600)]">
                        <Check className="h-4 w-4 text-green-600" />
                        Dispensed{rx.signedByName ? ` by ${rx.signedByName}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
                    {rx.status === 'pending_approval' && !draft && (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => startNote(rx.id, 'approved')}>
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => startNote(rx.id, 'rejected')}>
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </>
                    )}
                    {rx.status === 'approved' && (
                      <Button size="sm" disabled={busy} onClick={() => patch(rx.id, 'dispensed')}>
                        <Check className="h-3.5 w-3.5" />
                        {busy ? 'Dispensing…' : 'Dispense'}
                      </Button>
                    )}
                  </div>
                </div>

                {draft && (
                  <div className="border-t border-[var(--color-gray-100)] bg-[var(--color-gray-50)] p-5">
                    <label htmlFor={`note-${rx.id}`} className="block text-xs font-bold text-[var(--color-gray-700)]">
                      {draft.action === 'approved' ? 'Approval note (optional)' : 'Reason for rejection (optional)'}
                    </label>
                    <textarea
                      id={`note-${rx.id}`}
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      rows={2}
                      maxLength={400}
                      placeholder="Add a note for the patient or the dispensing record"
                      className="mt-2 w-full rounded-lg border border-[var(--color-gray-300)] bg-white p-3 text-sm outline-none focus:border-[var(--color-primary)]"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" disabled={busy} onClick={() => patch(rx.id, draft.action, noteText.trim() || undefined)}>
                        {busy ? 'Saving…' : draft.action === 'approved' ? 'Confirm approval' : 'Confirm rejection'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setNoteDraft(null);
                          setNoteText('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-[var(--color-gray-500)]">
        Prescription photo evidence is shared in the care chat and stays out of this queue. Always match the patient’s
        identity and allergy record before dispensing.
      </p>
    </div>
  );
}
