'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, FlaskConical, Plus, Stethoscope, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { STAGE_LABELS, STAGE_TONES, nextStage, stageIndex, type VisitStage } from '@/lib/workflow';

export interface QueueVisit {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  reason: string;
  time: string;
  mode: string;
  status: string;
  assignedTo?: string | undefined;
  mine: boolean;
  stage: VisitStage;
  invoice: { number: string; status: string; balance: number } | null;
}

export interface QueueLabOrder {
  id: string;
  appointmentId?: string | undefined;
  patientId: string;
  modality: 'laboratory' | 'imaging';
  test: string;
  clinicalQuestion: string;
  priceKes: number;
  status: 'ordered' | 'in_progress' | 'resulted';
  result?: string | undefined;
  interpretation?: string | undefined;
  createdAt: string;
  resultedAt?: string | undefined;
}

const TEST_PRESETS: Record<'laboratory' | 'imaging', string[]> = {
  laboratory: ['Full blood count', 'Malaria RDT', 'Urinalysis', 'Blood glucose', 'HIV rapid', 'Hepatitis B surface antigen'],
  imaging: ['Chest X-ray PA', 'Abdominal ultrasound', 'Pelvic ultrasound', 'X-ray limb']
};

const INTERPRETATIONS = ['Normal', 'Abnormal', 'Critical'] as const;

export function PatientQueue({
  initialVisits,
  initialLabOrders,
  meId,
  meName
}: {
  initialVisits: QueueVisit[];
  initialLabOrders: QueueLabOrder[];
  meId: string;
  meName: string;
}) {
  const router = useRouter();
  const [visits, setVisits] = useState<QueueVisit[]>(initialVisits);
  const [labs, setLabs] = useState<QueueLabOrder[]>(initialLabOrders);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [labFormFor, setLabFormFor] = useState<string | null>(null);

  function feedback(message: string) {
    setError('');
    setNotice(message);
  }

  async function patchVisit(id: string, payload: Record<string, string>, success: string): Promise<boolean> {
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as { error?: string; stage?: VisitStage };
      if (!res.ok) throw new Error(data.error || 'Update failed.');
      const nextValue = data.stage;
      setVisits((prev) => prev.map((v) => (v.id === id ? { ...v, stage: nextValue ?? v.stage, mine: payload.assignedTo ? true : v.mine } : v)));
      feedback(success);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
      return false;
    }
  }

  async function patchLab(id: string, payload: Record<string, string>, success: string) {
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/lab-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Update failed.');
      setLabs((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                status: (payload.status as QueueLabOrder['status']) ?? o.status,
                result: payload.result ?? o.result,
                interpretation: payload.interpretation ?? o.interpretation
              }
            : o
        )
      );
      feedback(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  }

  async function createLab(
    visit: QueueVisit,
    input: { modality: 'laboratory' | 'imaging'; test: string; clinicalQuestion: string }
  ): Promise<void> {
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/lab-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify({
          patientId: visit.patientId,
          appointmentId: visit.id,
          modality: input.modality,
          test: input.test,
          clinicalQuestion: input.clinicalQuestion
        })
      });
      const data = (await res.json()) as { error?: string; order?: QueueLabOrder };
      if (!res.ok || !data.order) throw new Error(data.error || 'Could not place the lab order.');
      setLabs((prev) => [data.order as QueueLabOrder, ...prev]);
      setLabFormFor(null);
      feedback(`${input.test} ordered — an invoice was sent to the patient.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place the lab order.');
    }
  }

  function labsFor(visit: QueueVisit): QueueLabOrder[] {
    return labs.filter((o) => o.appointmentId === visit.id || (!o.appointmentId && o.patientId === visit.patientId));
  }

  function startTriage(visit: QueueVisit) {
    void patchVisit(
      visit.id,
      visit.mine ? { stage: 'triage' } : { stage: 'triage', assignedTo: meId },
      `Triage started for ${visit.patientName}.`
    );
  }

  async function beginConsultation(visit: QueueVisit) {
    const ok = await patchVisit(
      visit.id,
      visit.mine ? { stage: 'consultation' } : { stage: 'consultation', assignedTo: meId },
      `Consultation started for ${visit.patientName}.`
    );
    if (ok) router.push(`/provider/consultations/${visit.id}`);
  }

  function advance(visit: QueueVisit) {
    const next = nextStage(visit.stage);
    if (!next) return;
    void patchVisit(visit.id, { stage: next }, `${visit.patientName} moved to ${STAGE_LABELS[next]}.`);
  }

  function completeVisit(visit: QueueVisit) {
    void patchVisit(visit.id, { stage: 'complete' }, `${visit.patientName}'s visit is complete.`);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <span className="inline-flex items-center gap-2 font-semibold">
          <Stethoscope className="h-4 w-4" />
          {meName}&apos;s queue — assigned visits first, then the unassigned pool.
        </span>
        <span className="text-xs font-bold">
          {visits.length} visit{visits.length === 1 ? '' : 's'} today
        </span>
      </div>

      {notice && <p className="mb-3 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">{notice}</p>}
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {visits.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <FlaskConical className="h-8 w-8 text-[var(--color-gray-300)]" />
          <p className="font-extrabold">No visits in your queue today</p>
          <p className="max-w-md text-sm text-[var(--color-gray-500)]">
            Walk-ins start at the front desk and online bookings arrive after check-in. Assign yourself from the board or wait for the front desk to route a patient.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {visits.map((visit) => {
            const visitLabs = labsFor(visit);
            const openLabs = visitLabs.filter((o) => o.status !== 'resulted').length;
            const next = nextStage(visit.stage);
            const unpaid = Boolean(visit.invoice && visit.invoice.balance > 0 && visit.invoice.status !== 'paid');
            return (
              <Card key={visit.id} className="p-0">
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-extrabold text-blue-700">
                      {visit.patientName
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-extrabold">{visit.patientName}</p>
                        <Badge tone={STAGE_TONES[visit.stage]}>{STAGE_LABELS[visit.stage]}</Badge>
                        <Badge tone={visit.mine ? 'primary' : 'neutral'}>{visit.mine ? 'Mine' : 'Unassigned'}</Badge>
                        {openLabs > 0 && <Badge tone="info">Labs {openLabs}</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-gray-600)]">{visit.reason}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--color-gray-500)]">
                        {visit.phone} · {visit.time} · {visit.mode.replace('_', ' ')}
                      </p>
                      {visit.invoice && (
                        <div className="mt-2">
                          {unpaid ? (
                            <Badge tone="warning">
                              Unpaid Ksh {visit.invoice.balance} · {visit.invoice.number}
                            </Badge>
                          ) : (
                            <Badge tone="success">
                              Paid · {visit.invoice.number}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {visit.stage === 'front_desk' && (
                      <Button type="button" size="sm" onClick={() => startTriage(visit)}>
                        <Stethoscope className="h-3.5 w-3.5" />
                        Start triage
                      </Button>
                    )}
                    {visit.stage === 'triage' && (
                      <Button type="button" size="sm" onClick={() => void beginConsultation(visit)}>
                        <Video className="h-3.5 w-3.5" />
                        Begin consultation
                      </Button>
                    )}
                    {stageIndex(visit.stage) >= stageIndex('consultation') && visit.stage !== 'complete' && (
                      <Button type="button" size="sm" variant="outline" onClick={() => router.push(`/provider/consultations/${visit.id}`)}>
                        <Video className="h-3.5 w-3.5" />
                        Open room
                      </Button>
                    )}
                    {next && visit.stage !== 'front_desk' && visit.stage !== 'triage' && visit.stage !== 'checkout' && (
                      <Button type="button" size="sm" variant="outline" onClick={() => advance(visit)}>
                        Advance to {STAGE_LABELS[next]}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {visit.stage === 'checkout' && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={unpaid}
                        title={unpaid ? 'Invoice unpaid — collect payment before completing the visit' : 'Complete the visit'}
                        onClick={() => completeVisit(visit)}
                      >
                        Complete visit
                      </Button>
                    )}
                    {visit.stage !== 'complete' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setLabFormFor((current) => (current === visit.id ? null : visit.id))}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {labFormFor === visit.id ? 'Cancel order' : 'Order lab/imaging'}
                      </Button>
                    )}
                  </div>

                  {labFormFor === visit.id && (
                    <LabOrderForm onCancel={() => setLabFormFor(null)} onCreated={(input) => void createLab(visit, input)} />
                  )}

                  {visitLabs.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-[var(--color-gray-100)] pt-4">
                      <p className="eyebrow">Lab &amp; imaging</p>
                      {visitLabs.map((order) => (
                        <LabOrderRow key={order.id} order={order} onPatch={(payload, message) => void patchLab(order.id, payload, message)} />
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LabOrderRow({ order, onPatch }: { order: QueueLabOrder; onPatch: (payload: Record<string, string>, message: string) => void }) {
  const [result, setResult] = useState('');
  const [interpretation, setInterpretation] = useState<string>('Normal');

  return (
    <div className="rounded-lg bg-[var(--color-gray-50)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">
          {order.test}
          <span className="ml-2 text-xs font-semibold text-[var(--color-gray-500)]">
            {order.modality} · Ksh {order.priceKes}
          </span>
        </p>
        <Badge tone={order.status === 'resulted' ? 'success' : order.status === 'in_progress' ? 'info' : 'warning'}>
          {order.status.replace('_', ' ')}
        </Badge>
      </div>
      {order.clinicalQuestion && (
        <p className="mt-1 text-xs text-[var(--color-gray-500)]">Question: {order.clinicalQuestion}</p>
      )}

      {order.status === 'ordered' && (
        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => onPatch({ status: 'in_progress' }, `${order.test} started.`)}>
          Mark in progress
        </Button>
      )}

      {order.status === 'in_progress' && (
        <div className="mt-3 space-y-2">
          <label htmlFor={`result-${order.id}`} className="block text-xs font-bold text-[var(--color-gray-600)]">
            Result
          </label>
          <Textarea id={`result-${order.id}`} value={result} onChange={(e) => setResult(e.target.value)} placeholder="Findings, values, report…" className="min-h-20" />
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor={`interp-${order.id}`} className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">
                Interpretation
              </label>
              <Select id={`interp-${order.id}`} value={interpretation} onChange={(e) => setInterpretation(e.target.value)} className="w-auto">
                {INTERPRETATIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={result.trim().length < 3}
              onClick={() => onPatch({ status: 'resulted', result: result.trim(), interpretation }, `${order.test} resulted.`)}
            >
              Save result
            </Button>
          </div>
        </div>
      )}

      {order.status === 'resulted' && (
        <div className="mt-2">
          <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--color-gray-700)]">{order.result}</p>
          {order.interpretation && (
            <div className="mt-1">
              <Badge tone={order.interpretation === 'Normal' ? 'success' : order.interpretation === 'Critical' ? 'error' : 'warning'}>
                {order.interpretation}
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LabOrderForm({
  onCancel,
  onCreated
}: {
  onCancel: () => void;
  onCreated: (input: { modality: 'laboratory' | 'imaging'; test: string; clinicalQuestion: string }) => void;
}) {
  const listId = useId();
  const [modality, setModality] = useState<'laboratory' | 'imaging'>('laboratory');
  const [test, setTest] = useState('');
  const [clinicalQuestion, setClinicalQuestion] = useState('');
  const [error, setError] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (test.trim().length < 2) {
      setError('Name the test to order.');
      return;
    }
    onCreated({ modality, test: test.trim(), clinicalQuestion: clinicalQuestion.trim() });
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-4">
      <p className="eyebrow">New order</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${listId}-modality`} className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">
            Modality
          </label>
          <Select id={`${listId}-modality`} value={modality} onChange={(e) => setModality(e.target.value as 'laboratory' | 'imaging')}>
            <option value="laboratory">Laboratory (from Ksh 1,500)</option>
            <option value="imaging">Imaging (from Ksh 3,500)</option>
          </Select>
        </div>
        <div>
          <label htmlFor={`${listId}-test`} className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">
            Test
          </label>
          <Input
            id={`${listId}-test`}
            list={`${listId}-presets`}
            value={test}
            onChange={(e) => setTest(e.target.value)}
            placeholder={modality === 'laboratory' ? 'e.g. Full blood count' : 'e.g. Chest X-ray PA'}
          />
          <datalist id={`${listId}-presets`}>
            {TEST_PRESETS[modality].map((preset) => (
              <option key={preset} value={preset} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor={`${listId}-question`} className="mb-1.5 block text-xs font-bold text-[var(--color-gray-600)]">
          Clinical question
        </label>
        <Input
          id={`${listId}-question`}
          value={clinicalQuestion}
          onChange={(e) => setClinicalQuestion(e.target.value)}
          placeholder="e.g. Anaemia screen for fatigue and pallor"
        />
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          <FlaskConical className="h-3.5 w-3.5" />
          Place order
        </Button>
      </div>
    </form>
  );
}
