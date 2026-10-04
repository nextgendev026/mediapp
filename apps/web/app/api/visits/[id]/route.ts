import { NextResponse } from 'next/server';
import { requireVisitAccess } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';
import { recordAudit } from '@/lib/server/audit';
import { readJsonBody, updateVisit, VISIT_PATCH_FIELDS } from '@/lib/server/visit-updates';
import { visitView } from '@/lib/server/visits';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const access = await requireVisitAccess(params.id);
  if ('error' in access) return access.error;

  const db = await getDb();
  const visit = visitView(db, access.visit);
  await recordAudit({
    actorId: access.caller.userId,
    actorRole: access.caller.role,
    action: 'visit_read',
    resourceType: 'appointment',
    resourceId: params.id,
    purpose: 'Care coordination',
    phiAccessed: true,
    metadata: { stage: visit.stage }
  });

  return NextResponse.json({ visit });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await readJsonBody(request);
  const result = await updateVisit({
    request,
    body,
    visitId: params.id,
    fields: VISIT_PATCH_FIELDS,
    purpose: 'Care coordination',
    action: 'visit_update'
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, visit: result.visit, stage: result.visit.stage });
}
