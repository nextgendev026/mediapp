import { NextResponse } from 'next/server';
import { readJsonBody, updateVisit } from '@/lib/server/visit-updates';

export const runtime = 'nodejs';

const ASSIGN_FIELDS = ['assignedProviderId', 'nurseId', 'roomId'] as const;

/** Routes a visit to a clinician, triage nurse, and consultation room without moving the stage. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const touchesAssignment = ASSIGN_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (!touchesAssignment) {
    return NextResponse.json({ error: 'Send assignedProviderId, nurseId, or roomId.' }, { status: 400 });
  }

  const result = await updateVisit({
    request,
    body,
    visitId: params.id,
    fields: ASSIGN_FIELDS,
    purpose: 'Care coordination',
    action: 'visit_assign'
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    ok: true,
    assignedProviderId: result.visit.assignedProviderId ?? null,
    nurseId: result.visit.nurseId ?? null,
    roomId: result.visit.roomId ?? null,
    stage: result.visit.stage,
    visit: result.visit
  });
}
