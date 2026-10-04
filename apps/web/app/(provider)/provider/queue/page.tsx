import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { PatientQueue, type QueueLabOrder, type QueueVisit } from '@/components/provider/PatientQueue';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';
import { isLiveVisit, stageOf } from '@/lib/workflow';
import { openLabOrders } from '@/lib/server/visits';

export const dynamic = 'force-dynamic';

export default async function ProviderQueuePage() {
  const guard = await requireRole(['provider']);
  if ('error' in guard) redirect(guard.error.status === 401 ? '/login' : '/provider/dashboard');

  const db = await getDb();
  const callerId = guard.caller.userId;
  const today = new Date().toISOString().slice(0, 10);

  const rows = db.appointments
    .filter((a) => a.date === today)
    .filter(isLiveVisit)
    .filter((a) => !a.assignedProviderId || a.assignedProviderId === callerId)
    .sort((a, b) => {
      const mineA = a.assignedProviderId === callerId ? 0 : 1;
      const mineB = b.assignedProviderId === callerId ? 0 : 1;
      if (mineA !== mineB) return mineA - mineB;
      return a.time < b.time ? -1 : 1;
    });

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
      assignedProviderId: a.assignedProviderId,
      nurseId: a.nurseId,
      roomId: a.roomId,
      triageNotes: a.triageNotes,
      checkinAt: a.checkinAt,
      mine: a.assignedProviderId === callerId,
      stage: stageOf(a),
      invoice: invoice ? { number: invoice.number, status: invoice.status, balance: invoice.totalKes - invoice.paidKes } : null
    };
  });

  const labOrders: QueueLabOrder[] = db.labOrders
    .filter((o) => patientIds.has(o.patientId))
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

  const unclaimed = visits.filter((v) => !v.assignedProviderId).length;
  const openLabs = rows.reduce((sum, a) => sum + openLabOrders(db, a).length, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Today's clinic"
        title="Patient queue"
        description="Visits assigned to you plus the unassigned pool for today: triage, consult, order labs, and carry visits through to checkout."
      />
      <div className="mb-4 flex flex-wrap gap-2 text-xs font-bold text-[var(--color-gray-600)]">
        <span className="rounded-lg bg-white px-3 py-1.5 shadow-[var(--shadow-card,0_1px_2px_rgba(16,24,40,0.06))]">
          {visits.length} visit{visits.length === 1 ? '' : 's'} today
        </span>
        <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-700">{unclaimed} unclaimed</span>
        <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-blue-700">{openLabs} lab/imaging in flight</span>
      </div>
      <PatientQueue initialVisits={visits} initialLabOrders={labOrders} meId={callerId} meName={guard.caller.name} />
    </div>
  );
}
