import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { PatientQueue, type QueueLabOrder, type QueueVisit } from '@/components/provider/PatientQueue';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';
import { stageOf } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

export default async function ProviderQueuePage() {
  const guard = await requireRole(['provider']);
  if ('error' in guard) redirect(guard.error.status === 401 ? '/login' : '/provider/dashboard');

  const db = await getDb();
  const callerId = guard.caller.userId;
  const today = new Date().toISOString().slice(0, 10);

  const rows = db.appointments
    .filter((a) => a.date === today && a.status !== 'cancelled' && a.status !== 'no_show')
    .filter((a) => stageOf(a) !== 'complete')
    .filter((a) => !a.assignedTo || a.assignedTo === callerId)
    .sort((a, b) => {
      const mineA = a.assignedTo === callerId ? 0 : 1;
      const mineB = b.assignedTo === callerId ? 0 : 1;
      if (mineA !== mineB) return mineA - mineB;
      return a.time < b.time ? -1 : 1;
    });

  const visitIds = new Set(rows.map((a) => a.id));
  const patientIds = new Set(rows.map((a) => a.patientId));

  const nameOf = (id: string): string => db.users.find((u) => u.id === id)?.fullName ?? 'Unknown';

  const visits: QueueVisit[] = rows.map((a) => {
    const patient = db.users.find((u) => u.id === a.patientId);
    const invoice = a.invoiceId ? db.invoices.find((i) => i.id === a.invoiceId) : undefined;
    return {
      id: a.id,
      patientId: a.patientId,
      patientName: nameOf(a.patientId),
      phone: patient?.phone ?? '',
      reason: a.reason,
      time: a.time,
      mode: a.mode,
      status: a.status,
      assignedTo: a.assignedTo,
      mine: a.assignedTo === callerId,
      stage: stageOf(a),
      invoice: invoice ? { number: invoice.number, status: invoice.status, balance: invoice.totalKes - invoice.paidKes } : null
    };
  });

  const labOrders: QueueLabOrder[] = db.labOrders
    .filter((o) => patientIds.has(o.patientId) && (!o.appointmentId || visitIds.has(o.appointmentId)))
    .map((o) => ({
      id: o.id,
      appointmentId: o.appointmentId,
      patientId: o.patientId,
      modality: o.modality,
      test: o.test,
      clinicalQuestion: o.clinicalQuestion,
      priceKes: o.priceKes,
      status: o.status,
      result: o.result,
      interpretation: o.interpretation,
      createdAt: o.createdAt,
      resultedAt: o.resultedAt
    }));

  return (
    <div>
      <PageHeader
        eyebrow="Today's clinic"
        title="Patient queue"
        description="Visits assigned to you plus the unassigned pool for today: triage, consult, order labs, and carry visits through to checkout."
      />
      <PatientQueue initialVisits={visits} initialLabOrders={labOrders} meId={callerId} meName={guard.caller.name} />
    </div>
  );
}
