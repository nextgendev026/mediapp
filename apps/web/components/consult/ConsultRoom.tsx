'use client';

import { AlertCircle, CheckCircle2, ClipboardList, LoaderCircle, MessageCircle, Pill, Plus, Stethoscope, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';

interface ExistingEncounter {
  id: string;
  appointmentId?: string | undefined;
  patientId: string;
  providerId: string;
  date: string;
  type: string;
  soap: { subjective: string; objective: string; assessment: string; plan: string };
  diagnosis?: string | undefined;
  outcome: string;
  status: string;
}

export interface ConsultRoomProps {
  appointmentId?: string | undefined;
  encounterId?: string | undefined;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  mode: string;
  date: string;
  time: string;
  reason: string;
  status: string;
  isProvider: boolean;
  existingEncounter?: ExistingEncounter | undefined;
}

type Outcome = 'treatment' | 'prescription' | 'referral' | 'admission';

interface MedRow {
  key: number;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
}

interface SaveResult {
  encounterId: string;
  drugs: string[];
  referral: { facility: string; level: string } | null;
  invoiceId: string | null;
}

const mutationHeaders = { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' };
const MAX_NOTES = 4000;

const OUTCOMES: { value: Outcome; label: string; hint: string }[] = [
  { value: 'treatment', label: 'Treatment', hint: 'Advice, procedures or follow-up only' },
  { value: 'prescription', label: 'Prescription', hint: 'Issue medicines for pharmacy review' },
  { value: 'referral', label: 'Referral', hint: 'Send to a higher facility or specialist' },
  { value: 'admission', label: 'Admission', hint: 'Admit the patient for inpatient care' }
];

const TO_LEVELS = ['Level 4', 'Level 5', 'Level 6', 'specialist clinic'] as const;

const SOAP_FIELDS = [
  { key: 'subjective' as const, label: 'Subjective', hint: 'What the patient reports' },
  { key: 'objective' as const, label: 'Objective', hint: 'Observations, vitals and examination' },
  { key: 'assessment' as const, label: 'Assessment', hint: 'Your clinical impression' },
  { key: 'plan' as const, label: 'Plan', hint: 'Treatment and follow-up plan' }
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value;
  return `${d} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

function statusTone(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'booked') return 'info';
  if (status === 'no_show') return 'warning';
  if (status === 'cancelled') return 'neutral';
  return 'neutral';
}

let rowCounter = 0;
function emptyRow(): MedRow {
  rowCounter += 1;
  return { key: rowCounter, name: '', dosage: '', frequency: '', duration: '', quantity: '1', instructions: '' };
}

export function ConsultRoom(props: ConsultRoomProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'consult' | 'chat'>(props.isProvider ? 'consult' : 'chat');
  const [soap, setSoap] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [diagnosis, setDiagnosis] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('treatment');
  const [items, setItems] = useState<MedRow[]>([emptyRow()]);
  const [toFacility, setToFacility] = useState('');
  const [toLevel, setToLevel] = useState<string>('Level 4');
  const [outcomeNote, setOutcomeNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);

  const encounter = props.existingEncounter;

  function updateRow(key: number, field: 'name' | 'dosage' | 'frequency' | 'duration' | 'quantity' | 'instructions', value: string) {
    setItems((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const next: MedRow = { ...row };
        next[field] = value;
        return next;
      })
    );
  }

  function validate(): string[] {
    const found: string[] = [];
    for (const field of SOAP_FIELDS) {
      if (!soap[field.key].trim()) found.push(`${field.label} notes are required.`);
    }
    if (outcome === 'prescription') {
      if (items.length === 0) found.push('Add at least one medication.');
      for (const row of items) {
        if (!row.name.trim()) found.push('Every medication row needs a medicine name.');
      }
    }
    if (outcome === 'referral') {
      if (!toFacility.trim()) found.push('Referral needs a destination facility.');
      if (!TO_LEVELS.includes(toLevel as (typeof TO_LEVELS)[number])) found.push('Referral needs a KEPH level.');
    }
    return found;
  }

  async function submit() {
    const found = validate();
    setErrors(found);
    if (found.length > 0) return;

    const body: Record<string, unknown> = {
      patientId: props.patientId,
      soap,
      diagnosis: diagnosis.trim(),
      outcome,
      outcomeNote: outcomeNote.trim()
    };
    if (props.appointmentId) body.appointmentId = props.appointmentId;
    if (outcome === 'prescription') {
      body.items = items.map((row) => ({
        name: row.name.trim(),
        dosage: row.dosage.trim(),
        frequency: row.frequency.trim(),
        duration: row.duration.trim(),
        quantity: Math.max(1, Math.min(500, Number(row.quantity) || 1)),
        instructions: row.instructions.trim()
      }));
    }
    if (outcome === 'referral') {
      body.toFacility = toFacility.trim();
      body.toLevel = toLevel;
    }

    setPending(true);
    try {
      const res = await fetch('/api/encounters', { method: 'POST', headers: mutationHeaders, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        encounter?: { id: string };
        prescription?: { items?: { name: string }[] } | null;
        referral?: { toFacility?: string; toLevel?: string } | null;
        invoiceId?: string | null;
      } | null;
      if (!res.ok || !data) throw new Error(data?.error ?? 'Could not save the encounter.');
      setResult({
        encounterId: data.encounter?.id ?? '',
        drugs: data.prescription?.items?.map((item) => item.name) ?? [],
        referral: data.referral?.toFacility ? { facility: data.referral.toFacility, level: data.referral.toLevel ?? '' } : null,
        invoiceId: data.invoiceId ?? null
      });
      setErrors([]);
      router.refresh();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Could not save the encounter.']);
    } finally {
      setPending(false);
    }
  }

  const chat = (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-[var(--color-primary)]" />
        <h2 className="font-extrabold">Secure chat</h2>
        <Badge tone="neutral">Encrypted</Badge>
      </div>
      <ChatPanel
        otherUserId={props.isProvider ? props.patientId : props.providerId}
        otherName={props.isProvider ? props.patientName : props.providerName}
        contextId={props.appointmentId ?? props.encounterId}
        topic={`Consultation ${props.date} ${props.time}`}
        heightClass="h-[500px]"
      />
    </Card>
  );

  const consultColumn = props.isProvider ? (
    result ? (
      <Card className="border-green-200 bg-green-50">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-700" />
          <div className="min-w-0">
            <h2 className="font-extrabold text-green-900">Encounter signed and saved</h2>
            <p className="mt-1 text-sm leading-6 text-green-800">
              Notes for {props.patientName} are recorded{result.encounterId ? ` (ref ${result.encounterId.slice(0, 8)})` : ''}. The patient has been notified.
            </p>
            {result.drugs.length > 0 && (
              <div className="mt-3 rounded-lg bg-white/70 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-green-800">Prescription issued</p>
                <ul className="mt-1 space-y-1 text-sm text-green-900">
                  {result.drugs.map((drug, index) => (
                    <li key={`${result.encounterId}-${index}`}>{drug}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.referral && (
              <div className="mt-3 rounded-lg bg-white/70 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-green-800">Referral issued</p>
                <p className="mt-1 text-sm font-semibold text-green-900">
                  {result.referral.facility}
                  {result.referral.level ? ` - ${result.referral.level}` : ''}
                </p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {result.invoiceId && (
                <Link href={`/invoice/${result.invoiceId}`}>
                  <Button size="sm" variant="outline">
                    View invoice
                  </Button>
                </Link>
              )}
              <Link href={`/provider/patients/${props.patientId}`}>
                <Button size="sm" variant="outline">
                  View patient chart
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
                Review notes
              </Button>
            </div>
          </div>
        </div>
      </Card>
    ) : (
      <Card id="encounter-form" className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-gray-100)] px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="font-extrabold">Clinical notes (SOAP)</h2>
          </div>
          <Badge tone="info">Signed by {props.providerName}</Badge>
        </div>

        <div className="space-y-5 p-5">
          {errors.length > 0 && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="flex items-center gap-2 text-sm font-extrabold text-red-800">
                <AlertCircle className="h-4 w-4" />
                Fix the following before signing:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                {errors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            {SOAP_FIELDS.map((field) => (
              <div key={field.key}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor={`soap-${field.key}`} className="text-sm font-bold">
                    {field.label} <span className="text-red-600">*</span>
                    <span className="ml-2 text-xs font-normal text-[var(--color-gray-500)]">{field.hint}</span>
                  </label>
                  <span className={`text-xs tabular-nums ${soap[field.key].length >= MAX_NOTES ? 'font-bold text-red-600' : 'text-[var(--color-gray-500)]'}`}>
                    {soap[field.key].length}/{MAX_NOTES}
                  </span>
                </div>
                <Textarea
                  id={`soap-${field.key}`}
                  value={soap[field.key]}
                  maxLength={MAX_NOTES}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSoap((current) => {
                      const next = { ...current };
                      next[field.key] = value;
                      return next;
                    });
                  }}
                  placeholder={`${field.label} - ${field.hint}`}
                  className="min-h-24 text-sm"
                />
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="encounter-diagnosis" className="mb-1.5 block text-sm font-bold">
              Diagnosis
            </label>
            <Input
              id="encounter-diagnosis"
              value={diagnosis}
              onChange={(event) => setDiagnosis(event.target.value)}
              placeholder="Provisional or confirmed diagnosis"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">
              Outcome <span className="text-red-600">*</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {OUTCOMES.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
                    outcome === option.value
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                      : 'border-[var(--color-gray-200)] bg-white hover:border-[#b9ebca]'
                  )}
                >
                  <input
                    type="radio"
                    name="encounter-outcome"
                    value={option.value}
                    checked={outcome === option.value}
                    onChange={() => setOutcome(option.value)}
                    className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--color-gray-500)]">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {outcome === 'prescription' && (
            <div className="rounded-xl border border-[var(--color-gray-200)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-[var(--color-primary)]" />
                  <h3 className="font-extrabold">Medications</h3>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setItems((current) => [...current, emptyRow()])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add medication
                </Button>
              </div>
              <div className="mt-4 space-y-4">
                {items.map((row, index) => (
                  <div key={row.key} className="rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">Medication {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => setItems((current) => (current.length > 1 ? current.filter((r) => r.key !== row.key) : current))}
                        disabled={items.length === 1}
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-bold text-red-600 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor={`med-name-${row.key}`} className="mb-1 block text-xs font-bold">
                          Medicine name <span className="text-red-600">*</span>
                        </label>
                        <Input id={`med-name-${row.key}`} value={row.name} onChange={(event) => updateRow(row.key, 'name', event.target.value)} placeholder="Amoxicillin 500mg" />
                      </div>
                      <div>
                        <label htmlFor={`med-dosage-${row.key}`} className="mb-1 block text-xs font-bold">
                          Dosage
                        </label>
                        <Input id={`med-dosage-${row.key}`} value={row.dosage} onChange={(event) => updateRow(row.key, 'dosage', event.target.value)} placeholder="1 capsule" />
                      </div>
                      <div>
                        <label htmlFor={`med-frequency-${row.key}`} className="mb-1 block text-xs font-bold">
                          Frequency
                        </label>
                        <Input id={`med-frequency-${row.key}`} value={row.frequency} onChange={(event) => updateRow(row.key, 'frequency', event.target.value)} placeholder="Three times daily" />
                      </div>
                      <div>
                        <label htmlFor={`med-duration-${row.key}`} className="mb-1 block text-xs font-bold">
                          Duration
                        </label>
                        <Input id={`med-duration-${row.key}`} value={row.duration} onChange={(event) => updateRow(row.key, 'duration', event.target.value)} placeholder="5 days" />
                      </div>
                      <div>
                        <label htmlFor={`med-quantity-${row.key}`} className="mb-1 block text-xs font-bold">
                          Quantity
                        </label>
                        <Input
                          id={`med-quantity-${row.key}`}
                          type="number"
                          min={1}
                          max={500}
                          value={row.quantity}
                          onChange={(event) => updateRow(row.key, 'quantity', event.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`med-instructions-${row.key}`} className="mb-1 block text-xs font-bold">
                          Instructions
                        </label>
                        <Input
                          id={`med-instructions-${row.key}`}
                          value={row.instructions}
                          onChange={(event) => updateRow(row.key, 'instructions', event.target.value)}
                          placeholder="Take after food. Complete the full course."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outcome === 'referral' && (
            <div className="grid gap-4 rounded-xl border border-[var(--color-gray-200)] p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="referral-facility" className="mb-1.5 block text-sm font-bold">
                  Destination facility <span className="text-red-600">*</span>
                </label>
                <Input id="referral-facility" value={toFacility} onChange={(event) => setToFacility(event.target.value)} placeholder="Kenyatta National Hospital - Cardiology" />
              </div>
              <div>
                <label htmlFor="referral-level" className="mb-1.5 block text-sm font-bold">
                  KEPH level <span className="text-red-600">*</span>
                </label>
                <Select id="referral-level" value={toLevel} onChange={(event) => setToLevel(event.target.value)}>
                  {TO_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="outcome-note" className="mb-1.5 block text-sm font-bold">
              Outcome notes / instructions
            </label>
            <Textarea
              id="outcome-note"
              value={outcomeNote}
              onChange={(event) => setOutcomeNote(event.target.value)}
              placeholder="Instructions for the patient and follow-up."
              className="min-h-20 text-sm"
            />
          </div>

          <Button type="button" className="w-full" disabled={pending} onClick={() => void submit()}>
            {pending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Sign & complete encounter
              </>
            )}
          </Button>
          <p className="text-center text-xs text-[var(--color-gray-500)]">
            Signing records your licence, notifies the patient and issues the consultation invoice.
          </p>
        </div>
      </Card>
    )
  ) : (
    <Card>
      <div className="flex items-center gap-2">
        <Stethoscope className="h-5 w-5 text-[var(--color-primary)]" />
        <h2 className="font-extrabold">Your clinical notes</h2>
        {encounter && <Badge tone="neutral">{encounter.outcome.replace(/_/g, ' ')}</Badge>}
      </div>
      {encounter ? (
        <div className="mt-4 space-y-4">
          {encounter.diagnosis && (
            <p className="rounded-lg bg-[var(--color-gray-50)] p-3 text-sm">
              <span className="font-bold">Diagnosis:</span> {encounter.diagnosis}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {SOAP_FIELDS.map((field) => (
              <div key={field.key} className="rounded-lg border border-[var(--color-gray-200)] p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-gray-500)]">{field.label}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--color-gray-700)]">{encounter.soap[field.key]}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--color-gray-300)] p-6 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-[var(--color-gray-300)]" />
          <p className="mt-3 font-extrabold">The clinician has not saved notes yet.</p>
          <p className="mt-1 text-sm text-[var(--color-gray-500)]">Notes and any prescription appear here as soon as the consultation is signed.</p>
        </div>
      )}
    </Card>
  );

  return (
    <div>
      <Card className="p-0">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold sm:text-2xl">{props.patientName}</h1>
              <Badge tone={statusTone(props.status)}>{props.status.replace(/_/g, ' ')}</Badge>
              <Badge tone="neutral">{props.mode.replace('_', ' ')}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-gray-600)]">
              <span>{formatDate(props.date)}</span>
              {props.time && <span>{props.time}</span>}
              <span>with {props.providerName}</span>
            </div>
            <p className="mt-2 text-sm text-[var(--color-gray-600)]">{props.reason}</p>
          </div>
          {props.isProvider && !result && (
            <a
              href="#encounter-form"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark)]"
            >
              Complete & save notes
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 border-t border-[var(--color-gray-100)] lg:hidden">
          <button
            type="button"
            onClick={() => setTab('consult')}
            className={cn(
              'flex min-h-12 items-center justify-center gap-2 border-b-2 text-sm font-bold',
              tab === 'consult' ? 'border-[var(--color-primary)] text-[var(--color-primary-dark)]' : 'border-transparent text-[var(--color-gray-500)]'
            )}
          >
            <ClipboardList className="h-4 w-4" />
            Consult
          </button>
          <button
            type="button"
            onClick={() => setTab('chat')}
            className={cn(
              'flex min-h-12 items-center justify-center gap-2 border-b-2 text-sm font-bold',
              tab === 'chat' ? 'border-[var(--color-primary)] text-[var(--color-primary-dark)]' : 'border-transparent text-[var(--color-gray-500)]'
            )}
          >
            <MessageCircle className="h-4 w-4" />
            Chat
          </button>
        </div>
      </Card>

      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:items-start lg:gap-5">
        <div className={cn(tab === 'consult' ? 'block' : 'hidden', 'lg:block')}>{consultColumn}</div>
        <div className={cn(tab === 'chat' ? 'block' : 'hidden', 'mt-5 lg:mt-0 lg:block')}>{chat}</div>
      </div>
    </div>
  );
}
