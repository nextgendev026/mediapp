import { NextResponse } from 'next/server';
import { isVisitStage } from '@/lib/workflow';
import { readJsonBody, updateVisit } from '@/lib/server/visit-updates';

export const runtime = 'nodejs';

const STAGE_FIELDS = ['stage', 'triageNotes', 'nurseId', 'roomId', 'status'] as const;

/** Moves a visit along the pathway and stamps check-in, room, nurse, and triage fields. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  if (!Object.prototype.hasOwnProperty.call(body, 'stage')) {
    return NextResponse.json({ error: 'A target stage is required.' }, { status: 400 });
  }
  if (!isVisitStage(body.stage)) return NextResponse.json({ error: 'Invalid stage.' }, { status: 400 });

  const result = await updateVisit({
    request,
    body,
    visitId: params.id,
    fields: STAGE_FIELDS,
    purpose: 'Care coordination',
    action: 'visit_stage'
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true, from: result.from, stage: result.visit.stage, visit: result.visit });
}
