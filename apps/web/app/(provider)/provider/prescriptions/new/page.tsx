'use client';

import { AlertCircle, CheckCircle2, FileText, LoaderCircle, Pill, Plus, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface PatientOption {
  id: string;
  fullName: string;
  phone: string;
}

interface MedRow {
  key: number;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
}

const mutationHeaders = { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' };

let rowCounter = 0;
function emptyRow(): MedRow {
  rowCounter += 1;
  return { key: rowCounter, name: '', dosage: '', frequency: '', duration: '', quantity: '1', instructions: '' };
}

export default function NewPrescriptionPage() {
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientId, setPatientId] = useState('');
  const [items, setItems] = useState<MedRow[]>([emptyRow()]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ prescriptionId: string; drugs: string[]; patientId: string } | null>(null);

  useEffect(() => {
    const preselect = new URLSearchParams(window.location.search).get('patientId') ?? '';
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/patients', { headers: { 'X-Afya-Client': 'web' } });
        if (!res.ok) throw new Error('Could not load your patient list.');
        const data = (await res.json()) as { patients: PatientOption[] };
        if (cancelled) return;
        setPatients(data.patients);
        if (preselect && data.patients.some((p) => p.id === preselect)) setPatientId(preselect);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load your patient list.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function submit() {
    const found: string[] = [];
    if (!patientId) found.push('Select the patient this prescription is for.');
    if (items.length === 0) found.push('Add at least one medication.');
    for (const row of items) {
      if (!row.name.trim()) found.push('Every medication row needs a medicine name.');
    }
    setErrors(found);
    if (found.length > 0) return;

    setPending(true);
    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: mutationHeaders,
        body: JSON.stringify({
          patientId,
          notes: notes.trim(),
          items: items.map((row) => ({
            name: row.name.trim(),
            dosage: row.dosage.trim(),
            frequency: row.frequency.trim(),
            duration: row.duration.trim(),
            quantity: Math.max(1, Math.min(500, Number(row.quantity) || 1)),
            instructions: row.instructions.trim()
          }))
        })
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        prescription?: { id: string; items?: { name: string }[] };
      } | null;
      if (!res.ok || !data?.prescription) throw new Error(data?.error ?? 'Could not create the prescription.');
      setResult({
        prescriptionId: data.prescription.id,
        drugs: data.prescription.items?.map((item) => item.name) ?? [],
        patientId
      });
      setErrors([]);
      setNotes('');
      setItems([emptyRow()]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Could not create the prescription.']);
    } finally {
      setPending(false);
    }
  }

  if (result) {
    const patient = patients.find((p) => p.id === result.patientId);
    return (
      <div>
        <PageHeader
          eyebrow="Clinical documentation"
          title="Prescription issued"
          description="The prescription is queued for pharmacist approval and the patient has been notified."
          backHref="/provider/dashboard"
        />
        <Card className="border-green-200 bg-green-50">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-700" />
            <div className="min-w-0">
              <h2 className="font-extrabold text-green-900">Signed for {patient?.fullName ?? 'your patient'}</h2>
              <ul className="mt-3 space-y-1 text-sm text-green-900">
                {result.drugs.map((drug, index) => (
                  <li key={`${result.prescriptionId}-${index}`}>{drug}</li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/provider/patients/${result.patientId}`}>
                  <Button size="sm" variant="outline">
                    View patient chart
                  </Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
                  Write another prescription
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Clinical documentation"
        title="New prescription"
        description="Issue a standalone prescription. Medicines go to the pharmacy queue for approval before dispensing."
        backHref="/provider/dashboard"
        action={
          <Badge tone="info">
            <Pill className="h-3.5 w-3.5" />
            E-prescription
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
        <div className="space-y-6">
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

          <Card>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--color-primary)]" />
              <h2 className="font-extrabold">Patient</h2>
            </div>
            <div className="mt-4">
              <label htmlFor="rx-patient" className="mb-1.5 block text-sm font-bold">
                Patient <span className="text-red-600">*</span>
              </label>
              <Select id="rx-patient" value={patientId} onChange={(event) => setPatientId(event.target.value)} disabled={loading}>
                <option value="">{loading ? 'Loading patients…' : 'Select a patient'}</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.fullName} - {patient.phone}
                  </option>
                ))}
              </Select>
              {loadError && <p className="mt-2 text-xs font-semibold text-red-600">{loadError}</p>}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-[var(--color-primary)]" />
                <h2 className="font-extrabold">Medications</h2>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems((current) => [...current, emptyRow()])}>
                <Plus className="h-3.5 w-3.5" />
                Add medication
              </Button>
            </div>
            <div className="mt-4 space-y-4">
              {items.map((row, index) => (
                <div key={row.key} className="rounded-xl border border-[var(--color-gray-200)] p-4">
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
                      <label htmlFor={`rx-name-${row.key}`} className="mb-1 block text-xs font-bold">
                        Medicine name <span className="text-red-600">*</span>
                      </label>
                      <Input id={`rx-name-${row.key}`} value={row.name} onChange={(event) => updateRow(row.key, 'name', event.target.value)} placeholder="Amoxicillin 500mg" />
                    </div>
                    <div>
                      <label htmlFor={`rx-dosage-${row.key}`} className="mb-1 block text-xs font-bold">
                        Dosage
                      </label>
                      <Input id={`rx-dosage-${row.key}`} value={row.dosage} onChange={(event) => updateRow(row.key, 'dosage', event.target.value)} placeholder="1 capsule" />
                    </div>
                    <div>
                      <label htmlFor={`rx-frequency-${row.key}`} className="mb-1 block text-xs font-bold">
                        Frequency
                      </label>
                      <Input id={`rx-frequency-${row.key}`} value={row.frequency} onChange={(event) => updateRow(row.key, 'frequency', event.target.value)} placeholder="Three times daily" />
                    </div>
                    <div>
                      <label htmlFor={`rx-duration-${row.key}`} className="mb-1 block text-xs font-bold">
                        Duration
                      </label>
                      <Input id={`rx-duration-${row.key}`} value={row.duration} onChange={(event) => updateRow(row.key, 'duration', event.target.value)} placeholder="5 days" />
                    </div>
                    <div>
                      <label htmlFor={`rx-quantity-${row.key}`} className="mb-1 block text-xs font-bold">
                        Quantity
                      </label>
                      <Input
                        id={`rx-quantity-${row.key}`}
                        type="number"
                        min={1}
                        max={500}
                        value={row.quantity}
                        onChange={(event) => updateRow(row.key, 'quantity', event.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor={`rx-instructions-${row.key}`} className="mb-1 block text-xs font-bold">
                        Instructions
                      </label>
                      <Input
                        id={`rx-instructions-${row.key}`}
                        value={row.instructions}
                        onChange={(event) => updateRow(row.key, 'instructions', event.target.value)}
                        placeholder="Take after food. Complete the full course."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <label htmlFor="rx-notes" className="mb-1.5 block text-sm font-bold">
              Clinical notes
            </label>
            <Textarea
              id="rx-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Allergy checks, review dates, monitoring instructions."
              className="min-h-24 text-sm"
            />
          </Card>

          <Button type="button" className="w-full" disabled={pending} onClick={() => void submit()}>
            {pending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Signing…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Sign and send prescription
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card>
            <p className="eyebrow">Before you sign</p>
            <h2 className="mt-1 text-lg font-extrabold">Clinical checks</h2>
            <ul className="mt-4 space-y-3 text-sm text-[var(--color-gray-600)]">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                Confirm allergies on the patient chart before prescribing.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                Generics are substituted only when the formulary allows it.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                Every prescription is audit-logged against your licence.
              </li>
            </ul>
          </Card>
          <Card className="border-amber-200 bg-amber-50">
            <p className="text-sm font-extrabold text-amber-900">Controlled medicines</p>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              Scheduleable medicines require an in-person review and a printed copy for the patient.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
