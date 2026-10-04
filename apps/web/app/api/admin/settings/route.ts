import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getSettings, saveSettings, SettingsValidationError } from '@/lib/server/settings';
import { recordAudit } from '@/lib/server/audit';
import { isSameOriginMutation } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireRole(['admin']);
  if ('error' in guard) return guard.error;
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const guard = await requireRole(['admin']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'No settings were provided.' }, { status: 400 });
  }

  try {
    const settings = await saveSettings(body, guard.caller.name);
    await recordAudit({
      actorId: guard.caller.userId,
      actorRole: guard.caller.role,
      action: 'settings_update',
      resourceType: 'settings',
      resourceId: 'app_settings',
      purpose: 'Platform configuration',
      phiAccessed: false,
      metadata: { keys: Object.keys(body).join(',').slice(0, 160) }
    });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 });
  }
}
