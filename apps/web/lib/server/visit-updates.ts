import { getDb } from './store';
import { recordAudit } from './audit';
import { notify } from './notify';
import { requireVisitAccess, isVisitActorRole } from './guard';
import { isSameOriginMutation, str } from './security';
import { VisitStage, isVisitStage, isVisitStatus, stageOf, STAGE_LABELS } from '../workflow';
import { MAX_ROOM_ID, MAX_TRIAGE_NOTES, changeVisit, nameOf, visitView, type StagePatch, type VisitView } from './visits';

export const VISIT_PATCH_FIELDS = ['stage', 'status', 'triageNotes', 'nurseId', 'roomId', 'assignedProviderId'] as const;
export type VisitPatchField = (typeof VISIT_PATCH_FIELDS)[number];

export type VisitUpdateOutcome =
  | { ok: true; visit: VisitView; from: VisitStage }
  | { ok: false; status: number; error: string };

export function parseVisitPatch(body: Record<string, unknown>): StagePatch | null {
  const patch: StagePatch = {};
  let touched = false;

  if (Object.prototype.hasOwnProperty.call(body, 'stage')) {
    if (!isVisitStage(body.stage)) return null;
    patch.stage = body.stage;
    touched = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (!isVisitStatus(body.status)) return null;
    patch.status = body.status;
    touched = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'triageNotes')) {
    patch.triageNotes = str(body.triageNotes, MAX_TRIAGE_NOTES).trim();
    touched = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'nurseId')) {
    patch.nurseId = str(body.nurseId, 64);
    touched = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'roomId')) {
    patch.roomId = str(body.roomId, MAX_ROOM_ID).trim();
    touched = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'assignedProviderId')) {
    patch.assignedProviderId = str(body.assignedProviderId, 64);
    touched = true;
  }

  return touched ? patch : null;
}

function pickFields(patch: StagePatch, fields: readonly VisitPatchField[]): StagePatch {
  const picked: StagePatch = {};
  for (const field of fields) {
    const value = patch[field];
    if (value !== undefined) (picked as Record<string, string | undefined>)[field] = value;
  }
  return picked;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Single write path for the visit pathway: authorise the caller against the visit, validate the
 * stage rules, persist, then notify and audit. Every visit route funnels through here so the
 * guard rails stay identical across stage, assignment, and the general patch endpoint.
 */
export async function updateVisit(input: {
  request: Request;
  body: Record<string, unknown> | null;
  visitId: string;
  fields: readonly VisitPatchField[];
  purpose: string;
  action: string;
}): Promise<VisitUpdateOutcome> {
  const access = await requireVisitAccess(input.visitId);
  if ('error' in access) {
    const body = (await access.error.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, status: access.error.status, error: body?.error ?? 'Visit update blocked.' };
  }
  if (!isSameOriginMutation(input.request)) {
    return { ok: false, status: 403, error: 'Cross-origin request blocked.' };
  }

  if (!input.body) return { ok: false, status: 400, error: 'Invalid request body.' };

  const parsed = parseVisitPatch(input.body);
  if (!parsed) return { ok: false, status: 400, error: 'Nothing valid to update.' };

  const patch = pickFields(parsed, input.fields);
  if (Object.keys(patch).length === 0) {
    return { ok: false, status: 400, error: 'No updatable field was supplied for this endpoint.' };
  }

  const from = stageOf(access.visit);
  const actor = isVisitActorRole(access.caller.role)
    ? { userId: access.caller.userId, role: access.caller.role }
    : null;
  const { visit, refusal } = await changeVisit(input.visitId, actor, patch);
  if (refusal || !visit) {
    return { ok: false, status: refusal?.status ?? 404, error: refusal?.error ?? 'Visit not found.' };
  }

  const db = await getDb();
  const stage = stageOf(visit);
  const reassigned = Boolean(patch.assignedProviderId && patch.assignedProviderId !== access.visit.assignedProviderId);

  if (reassigned) {
    await notify({
      userId: patch.assignedProviderId as string,
      title: 'Visit assigned to you',
      body: `${nameOf(db, visit.patientId)} — ${visit.reason.slice(0, 100)}. ${visit.date} at ${visit.time}.`,
      type: 'appointment',
      href: '/provider/queue'
    });
  }

  if (patch.stage && patch.stage !== from) {
    const audience = new Set<string>();
    if (visit.assignedProviderId) audience.add(visit.assignedProviderId);
    if (visit.nurseId) audience.add(visit.nurseId);
    const recipient = Array.from(audience)[0];
    if (recipient) {
      await notify({
        userId: recipient,
        title: `${nameOf(db, visit.patientId)} is now at ${STAGE_LABELS[stage]}`,
        body: `${visit.reason.slice(0, 120)} · ${visit.time}${visit.roomId ? ` · Room ${visit.roomId}` : ''}`,
        type: 'appointment',
        href: '/provider/queue'
      });
    }
    if (stage === VisitStage.Checkout || stage === VisitStage.Complete) {
      await notify({
        userId: visit.patientId,
        title: stage === VisitStage.Complete ? 'Visit complete' : 'Ready for checkout',
        body:
          stage === VisitStage.Complete
            ? `Your visit on ${visit.date} is complete. Thank you for choosing AfyaCommerce.`
            : `Your consultation is finished. Please settle the invoice for ${visit.date}.`,
        type: 'appointment',
        href: '/dashboard'
      });
    }
  }

  await recordAudit({
    actorId: access.caller.userId,
    actorRole: access.caller.role,
    action: input.action,
    resourceType: 'appointment',
    resourceId: visit.id,
    purpose: input.purpose,
    phiAccessed: true,
    metadata: {
      from,
      to: stage,
      ...(reassigned ? { assignedProviderId: patch.assignedProviderId ?? 'unassigned' } : {}),
      ...(patch.nurseId ? { nurseId: patch.nurseId || 'unassigned' } : {}),
      ...(patch.roomId ? { roomId: patch.roomId || 'unassigned' } : {})
    }
  });

  return { ok: true, visit: visitView(db, visit), from };
}
