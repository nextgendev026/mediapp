import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate } from '@/lib/server/store';
import { isSameOriginMutation } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['patient', 'provider', 'pharmacist', 'admin', 'rider']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  const db = await getDb();
  const thread = db.threads.find((t) => t.id === params.id);
  if (!thread) return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });
  if (!thread.participantIds.includes(guard.caller.userId)) {
    return NextResponse.json({ error: 'Not a participant in this thread.' }, { status: 403 });
  }

  await mutate((db2) => {
    for (const message of db2.messages) {
      if (message.threadId !== params.id) continue;
      if (message.readBy.includes(guard.caller.userId)) continue;
      message.readBy = [...message.readBy, guard.caller.userId];
    }
  });

  return NextResponse.json({ ok: true });
}
