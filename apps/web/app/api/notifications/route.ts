import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const guard = await requireRole();
  if ('error' in guard) return guard.error;

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread') === '1';

  const db = await getDb();
  const mine = db.notifications.filter((n) => n.userId === guard.caller.userId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const unread = mine.filter((n) => !n.read).length;
  const notifications = (unreadOnly ? mine.filter((n) => !n.read) : mine).slice(0, 100);

  return NextResponse.json({ notifications, unread });
}
