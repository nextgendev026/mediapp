export type VisitStage =
  | 'front_desk'
  | 'triage'
  | 'consultation'
  | 'lab_imaging'
  | 'diagnosis'
  | 'prescription'
  | 'checkout'
  | 'complete';

export const VISIT_STAGES: readonly VisitStage[] = [
  'front_desk',
  'triage',
  'consultation',
  'lab_imaging',
  'diagnosis',
  'prescription',
  'checkout',
  'complete'
];

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

export interface StageCarrier {
  stage?: VisitStage | undefined;
  status: string;
}

export function stageOf(appt: StageCarrier): VisitStage {
  if (appt.stage) return appt.stage;
  return appt.status === 'booked' ? 'front_desk' : 'complete';
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
