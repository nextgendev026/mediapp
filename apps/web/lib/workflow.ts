export const VisitStage = {
  FrontDesk: 'front_desk',
  Triage: 'triage',
  Consultation: 'consultation',
  LabImaging: 'lab_imaging',
  Diagnosis: 'diagnosis',
  Prescription: 'prescription',
  Checkout: 'checkout',
  Complete: 'complete'
} as const;

export type VisitStage = (typeof VisitStage)[keyof typeof VisitStage];

export const VISIT_STAGES: readonly VisitStage[] = [
  VisitStage.FrontDesk,
  VisitStage.Triage,
  VisitStage.Consultation,
  VisitStage.LabImaging,
  VisitStage.Diagnosis,
  VisitStage.Prescription,
  VisitStage.Checkout,
  VisitStage.Complete
];

export const VISIT_STATUSES = ['booked', 'completed', 'cancelled', 'no_show'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const STAGE_LABELS: Record<VisitStage, string> = {
  front_desk: 'Front desk',
  triage: 'Triage',
  consultation: 'Consultation',
  lab_imaging: 'Lab/Imaging',
  diagnosis: 'Diagnosis',
  prescription: 'Prescription',
  checkout: 'Checkout',
  complete: 'Complete'
};

export const STAGE_SHORT_LABELS: Record<VisitStage, string> = {
  front_desk: 'Front desk',
  triage: 'Triage',
  consultation: 'Consult',
  lab_imaging: 'Lab',
  diagnosis: 'Diagnosis',
  prescription: 'Rx',
  checkout: 'Checkout',
  complete: 'Done'
};

export const STAGE_DESCRIPTIONS: Record<VisitStage, string> = {
  front_desk: 'Register the patient, confirm payment, and route to a clinician.',
  triage: 'Nurse records vitals, history, and triage notes.',
  consultation: 'Clinician assesses the patient in the consultation room.',
  lab_imaging: 'Laboratory or imaging ordered and in progress.',
  diagnosis: 'Clinician confirms the diagnosis and management plan.',
  prescription: 'Medicines prescribed and awaiting pharmacy dispensing.',
  checkout: 'Settle the invoice and release the patient.',
  complete: 'Visit closed and the patient notified.'
};

export type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';

export const STAGE_TONES: Record<VisitStage, BadgeTone> = {
  front_desk: 'warning',
  triage: 'info',
  consultation: 'primary',
  lab_imaging: 'neutral',
  diagnosis: 'warning',
  prescription: 'info',
  checkout: 'primary',
  complete: 'success'
};

export const VISIT_ACTOR_ROLES = ['admin', 'provider', 'pharmacist'] as const;
export type VisitActorRole = (typeof VISIT_ACTOR_ROLES)[number];

/** Roles allowed to move a visit *into* a stage. */
export const STAGE_ENTRY_ROLES: Record<VisitStage, readonly VisitActorRole[]> = {
  front_desk: ['admin'],
  triage: ['provider', 'admin'],
  consultation: ['provider', 'admin'],
  lab_imaging: ['provider', 'admin'],
  diagnosis: ['provider', 'admin'],
  prescription: ['provider', 'admin'],
  checkout: ['provider', 'pharmacist', 'admin'],
  complete: ['admin', 'provider']
};

/** Roles allowed to act on a visit that already sits in a stage, e.g. dispensing at prescription. */
export const STAGE_WORKBENCH_ROLES: Record<VisitStage, readonly VisitActorRole[]> = {
  front_desk: ['admin'],
  triage: ['provider', 'admin'],
  consultation: ['provider', 'admin'],
  lab_imaging: ['provider', 'admin'],
  diagnosis: ['provider', 'admin'],
  prescription: ['provider', 'pharmacist', 'admin'],
  checkout: ['provider', 'pharmacist', 'admin'],
  complete: ['admin', 'provider']
};

export interface StageCarrier {
  stage?: VisitStage | undefined;
  status: VisitStatus | string;
}

export function stageOf(appt: StageCarrier): VisitStage {
  if (appt.stage) return appt.stage;
  return appt.status === 'booked' ? VisitStage.FrontDesk : VisitStage.Complete;
}

export function stageIndex(stage: VisitStage): number {
  return VISIT_STAGES.indexOf(stage);
}

export function nextStage(stage: VisitStage): VisitStage | null {
  const index = stageIndex(stage);
  if (index < 0 || index >= VISIT_STAGES.length - 1) return null;
  return VISIT_STAGES[index + 1] ?? null;
}

export function isVisitStage(value: unknown): value is VisitStage {
  return typeof value === 'string' && (VISIT_STAGES as readonly string[]).includes(value);
}

export function isVisitStatus(value: unknown): value is VisitStatus {
  return typeof value === 'string' && (VISIT_STATUSES as readonly string[]).includes(value);
}

export function canEnterStage(role: VisitActorRole, stage: VisitStage): boolean {
  return STAGE_ENTRY_ROLES[stage].includes(role);
}

export function canActInStage(role: VisitActorRole, stage: VisitStage): boolean {
  return STAGE_WORKBENCH_ROLES[stage].includes(role);
}

export function isForwardMove(from: VisitStage, to: VisitStage): boolean {
  return stageIndex(to) > stageIndex(from);
}

export function stageAtLeast(stage: VisitStage, minimum: VisitStage): boolean {
  return stageIndex(stage) >= stageIndex(minimum);
}

export function isCheckoutStage(stage: VisitStage): boolean {
  return stage === VisitStage.Checkout || stage === VisitStage.Complete;
}

export function isTerminalStage(stage: VisitStage): boolean {
  return stage === VisitStage.Complete;
}

export function isLiveVisit(appt: StageCarrier): boolean {
  return appt.status !== 'cancelled' && appt.status !== 'no_show' && !isTerminalStage(stageOf(appt));
}
