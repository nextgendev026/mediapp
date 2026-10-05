import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getSecurityStatus } from '@/lib/security/auto-mend';
import { unblockTarget } from '@/lib/security/intrusion-detection';
import { rotateSessionKey } from '@/lib/security/key-rotation';
import { triggerLockdown } from '@/lib/security/auto-mend';
import { recordAudit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireRole(['admin']);
  if ('error' in guard) return guard.error;
  const status = await getSecurityStatus();
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['admin']);
  if ('error' in guard) return guard.error;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const action = typeof body.action === 'string' ? body.action : '';
  const target = typeof body.target === 'string' ? body.target : '';
  const actor = guard.caller;

  if (action === 'unblock' && target) {
    await unblockTarget(target);
    await recordAudit({
      actorId: actor.userId, actorRole: 'admin', action: 'security_unblock',
      resourceType: 'security_block', resourceId: target, purpose: 'Security management', phiAccessed: false, ip: clientIp(request)
    });
    return NextResponse.json({ ok: true, action, target });
  }

  if (action === 'rotate_key') {
    const version = await rotateSessionKey();
    await recordAudit({
      actorId: actor.userId, actorRole: 'admin', action: 'security_key_rotation',
      resourceType: 'session_key', purpose: 'Security management', phiAccessed: false, ip: clientIp(request)
    });
    return NextResponse.json({ ok: true, action, version });
  }

  if (action === 'lockdown') {
    await triggerLockdown('manual_admin_lockdown');
    await recordAudit({
      actorId: actor.userId, actorRole: 'admin', action: 'security_lockdown',
      resourceType: 'system', purpose: 'Security management', phiAccessed: false, ip: clientIp(request)
    });
    return NextResponse.json({ ok: true, action });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
