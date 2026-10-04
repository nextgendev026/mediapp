import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { mutate } from '@/lib/server/store';
import { isSameOriginMutation } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const guard = await requireRole();
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  let ids: string[] = [];
  try {
    const body = (await request.json()) as { ids?: unknown };
    if (Array.isArray(body.ids)) {
      ids = body.ids.filter((value): value is string => typeof value === 'string' && value.length > 0 && value.length <= 64);
    }
  } catch {
    ids = [];
  }

  await mutate((db) => {
    const wanted = new Set(ids);
    for (const notification of db.notifications) {
      if (notification.userId !== guard.caller.userId) continue;
      if (ids.length > 0 && !wanted.has(notification.id)) continue;
      notification.read = true;
    }
  });

  return NextResponse.json({ ok: true });
}
