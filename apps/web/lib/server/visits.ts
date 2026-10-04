import { getDb, mutate, type Appointment, type Database, type LabOrder, type Visit } from './store';
import {
  VisitStage,
  canEnterStage,
  isCheckoutStage,
  isForwardMove,
  isTerminalStage,
  nextStage,
  stageIndex,
  stageOf,
  STAGE_LABELS,
  type VisitActorRole,
  type VisitStatus
} from '../workflow';

export const MAX_TRIAGE_NOTES = 2000;
export const MAX_ROOM_ID = 40;

export interface VisitActor {
  userId: string;
  role: VisitActorRole;
  name?: string | undefined;
}

export interface VisitInvoiceView {
  number: string;
  status: string;
  balance: number;
}

export interface VisitView {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  providerId: string;
  providerName: string;
  assignedProviderId?: string | undefined;
  assignedProviderName: string;
  nurseId?: string | undefined;
  nurseName: string;
  roomId?: string | undefined;
  triageNotes?: string | undefined;
  checkinAt?: string | undefined;
  checkoutAt?: string | undefined;
  date: string;
  time: string;
  mode: string;
  status: VisitStatus;
  reason: string;
  feeKes: number;
  stage: VisitStage;
  nextStage: VisitStage | null;
  openLabs: number;
  invoice: VisitInvoiceView | null;
}

export interface StagePatch {
  stage?: VisitStage | undefined;
  status?: VisitStatus | undefined;
  triageNotes?: string | undefined;
  nurseId?: string | undefined;
  roomId?: string | undefined;
  assignedProviderId?: string | undefined;
}

export interface StageRefusal {
  status: number;
  error: string;
}

export function nameOf(db: Database, id: string | undefined): string {
  if (!id) return '';
  return db.users.find((u) => u.id === id)?.fullName ?? 'Unknown';
}

export function phoneOf(db: Database, id: string): string {
  return db.users.find((u) => u.id === id)?.phone ?? '';
}

export function visitOrders(db: Database, visit: Pick<Appointment, 'id' | 'patientId'>): LabOrder[] {
  return db.labOrders.filter((o) => o.appointmentId === visit.id || (!o.appointmentId && o.patientId === visit.patientId));
}

export function openLabOrders(db: Database, visit: Pick<Appointment, 'id' | 'patientId'>): LabOrder[] {
  return visitOrders(db, visit).filter((o) => o.status !== 'resulted');
}

export function visitInvoice(db: Database, visit: Appointment) {
  return visit.invoiceId ? db.invoices.find((i) => i.id === visit.invoiceId) : undefined;
}

export function invoiceBalance(invoice: { totalKes: number; paidKes: number } | undefined): number {
  return invoice ? invoice.totalKes - invoice.paidKes : 0;
}

export function visitView(db: Database, visit: Visit): VisitView {
  const invoice = visitInvoice(db, visit);
  const stage = stageOf(visit);
  return {
    id: visit.id,
    patientId: visit.patientId,
    patientName: nameOf(db, visit.patientId) || 'Unknown',
    phone: phoneOf(db, visit.patientId),
    providerId: visit.providerId,
    providerName: nameOf(db, visit.providerId) || 'Unassigned',
    assignedProviderId: visit.assignedProviderId,
    assignedProviderName: nameOf(db, visit.assignedProviderId),
    nurseId: visit.nurseId,
    nurseName: nameOf(db, visit.nurseId),
    roomId: visit.roomId,
    triageNotes: visit.triageNotes,
    checkinAt: visit.checkinAt,
    checkoutAt: visit.checkoutAt,
    date: visit.date,
    time: visit.time,
    mode: visit.mode,
    status: visit.status,
    reason: visit.reason,
    feeKes: visit.feeKes,
    stage,
    nextStage: nextStage(stage),
    openLabs: openLabOrders(db, visit).length,
    invoice: invoice
      ? { number: invoice.number, status: invoice.status, balance: invoice.totalKes - invoice.paidKes }
      : null
  };
}

export interface VisitFilter {
  date?: string | null | undefined;
  stage?: VisitStage | null | undefined;
  patientId?: string | null | undefined;
  providerId?: string | null | undefined;
  status?: VisitStatus | null | undefined;
  includeClosed?: boolean | undefined;
}

export async function listVisitViews(filter: VisitFilter = {}): Promise<VisitView[]> {
  const db = await getDb();
  let rows = db.appointments.slice();
  if (filter.date) rows = rows.filter((a) => a.date === filter.date);
  if (filter.patientId) rows = rows.filter((a) => a.patientId === filter.patientId);
  if (filter.providerId) {
    rows = rows.filter((a) => a.providerId === filter.providerId || a.assignedProviderId === filter.providerId);
  }
  if (filter.stage) rows = rows.filter((a) => stageOf(a) === filter.stage);
  if (filter.status) rows = rows.filter((a) => a.status === filter.status);
  if (!filter.includeClosed) {
    rows = rows.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show' && !isTerminalStage(stageOf(a)));
  }
  rows.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  return rows.map((a) => visitView(db, a));
}

/**
 * Pure stage rules shared by the visit routes. System-driven transitions (encounters,
 * lab results, dispensing) pass `system: true` and skip role and forward-only checks.
 */
export function validateStagePatch(
  db: Database,
  visit: Appointment,
  actor: VisitActor | null,
  patch: StagePatch,
  system = false
): StageRefusal | null {
  if (patch.nurseId) {
    const nurse = db.users.find((u) => u.id === patch.nurseId && u.role === 'provider');
    if (!nurse) return { status: 400, error: 'Triage nurse must be an existing clinician account.' };
    if (nurse.status !== 'active') return { status: 400, error: 'Triage nurse account is not active.' };
  }
  if (patch.assignedProviderId) {
    const clinician = db.users.find((u) => u.id === patch.assignedProviderId && u.role === 'provider');
    if (!clinician) return { status: 400, error: 'Assigned clinician must be an existing clinician account.' };
    if (clinician.status !== 'active') return { status: 400, error: 'Assigned clinician account is not active.' };
  }
  if (!patch.stage) return null;

  const current = stageOf(visit);
  const target = patch.stage;
  if (target === current) return null;

  if (actor && !system) {
    if (!canEnterStage(actor.role, target)) {
      return { status: 403, error: `${STAGE_LABELS[target]} is owned by another team. Ask an administrator to move the visit.` };
    }
    if (actor.role !== 'admin' && !isForwardMove(current, target)) {
      return {
        status: 409,
        error: `Visits move forward only (current stage: ${STAGE_LABELS[current]}). An admin can correct the stage.`
      };
    }
  }

  if (isCheckoutStage(target)) {
    const pending = openLabOrders(db, visit);
    if (pending.length > 0) {
      return {
        status: 409,
        error: `${pending.length} lab or imaging order${pending.length === 1 ? '' : 's'} still pending. Release results before checkout.`
      };
    }
    const invoice = visitInvoice(db, visit);
    const balance = invoiceBalance(invoice);
    if (balance > 0) {
      return {
        status: 409,
        error: `Invoice ${invoice?.number ?? ''} still has a balance of Ksh ${balance}. Collect payment before checkout.`.trim()
      };
    }
  }

  if (target === VisitStage.Consultation && actor?.role !== 'admin' && !patch.triageNotes && !visit.triageNotes) {
    return { status: 409, error: 'Record triage notes before opening the consultation.' };
  }

  if (target === VisitStage.Complete && actor && actor.role !== 'admin' && current !== VisitStage.Checkout) {
    return { status: 409, error: 'Move the visit to checkout before completing it.' };
  }

  return null;
}

export function applyStagePatch(visit: Appointment, patch: StagePatch, nowIso: string): void {
  if (patch.triageNotes !== undefined) visit.triageNotes = patch.triageNotes.trim() || undefined;
  if (patch.nurseId !== undefined) visit.nurseId = patch.nurseId || undefined;
  if (patch.roomId !== undefined) visit.roomId = patch.roomId || undefined;
  if (patch.assignedProviderId !== undefined) {
    visit.assignedProviderId = patch.assignedProviderId || undefined;
  }
  if (patch.stage !== undefined) {
    if (stageOf(visit) !== patch.stage) {
      visit.stage = patch.stage;
      if (stageIndex(patch.stage) >= stageIndex(VisitStage.Triage) && !visit.checkinAt) visit.checkinAt = nowIso;
      if (isCheckoutStage(patch.stage) && !visit.checkoutAt) visit.checkoutAt = nowIso;
      if (isTerminalStage(patch.stage)) visit.status = 'completed';
    }
  }
  if (patch.status !== undefined) visit.status = patch.status;
}

export interface StageChangeResult {
  visit: Visit | null;
  refusal: StageRefusal | null;
  from: VisitStage;
}

export async function changeVisit(
  visitId: string,
  actor: VisitActor | null,
  patch: StagePatch,
  options: { system?: boolean } = {}
): Promise<StageChangeResult> {
  const db = await getDb();
  const current = db.appointments.find((a) => a.id === visitId);
  if (!current) return { visit: null, refusal: { status: 404, error: 'Visit not found.' }, from: VisitStage.FrontDesk };

  const from = stageOf(current);
  const refusal = validateStagePatch(db, current, actor, patch, options.system === true);
  if (refusal) return { visit: null, refusal, from };

  const nowIso = new Date().toISOString();
  const visit = await mutate((db2) => {
    const row = db2.appointments.find((a) => a.id === visitId);
    if (!row) return null;
    applyStagePatch(row, patch, nowIso);
    return row;
  });

  return { visit, refusal: null, from };
}

/** System auto-advance used by encounters, lab results, dispensing, and booking lifecycles. */
export async function moveVisit(
  visitId: string | undefined,
  to: VisitStage,
  options: { system?: boolean; force?: boolean } = {}
): Promise<VisitStage | null> {
  if (!visitId) return null;
  const db = await getDb();
  const row = db.appointments.find((a) => a.id === visitId);
  if (!row) return null;
  const current = stageOf(row);
  if (current === to) return current;
  if (!options.force && !isForwardMove(current, to)) return current;

  await mutate((db2) => {
    const target = db2.appointments.find((a) => a.id === visitId);
    if (!target) return;
    applyStagePatch(target, { stage: to }, new Date().toISOString());
  });
  return to;
}

export function stageSummary(db: Database): Record<VisitStage, number> {
  const counts = Object.fromEntries(
    Object.values(VisitStage).map((stage) => [stage, 0])
  ) as Record<VisitStage, number>;
  for (const appt of db.appointments) {
    if (appt.status === 'cancelled' || appt.status === 'no_show') continue;
    counts[stageOf(appt)] += 1;
  }
  return counts;
}
