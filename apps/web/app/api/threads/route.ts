import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate, newId, type Thread } from '@/lib/server/store';
import { isSameOriginMutation, str } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireRole(['patient', 'provider', 'pharmacist', 'admin', 'rider']);
  if ('error' in guard) return guard.error;
  const db = await getDb();
  const threads = db.threads
    .filter((t) => t.participantIds.includes(guard.caller.userId))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map((t) => {
      const messages = db.messages.filter((m) => m.threadId === t.id);
      const last = messages[messages.length - 1];
      const otherId = t.participantIds.find((id) => id !== guard.caller.userId) ?? t.participantIds[0] ?? '';
      return {
        id: t.id,
        topic: t.topic,
        contextId: t.contextId,
        otherName: db.users.find((u) => u.id === otherId)?.fullName ?? 'Support',
        otherRole: db.users.find((u) => u.id === otherId)?.role ?? 'admin',
        lastText: last?.text ?? (last?.attachmentId ? '📎 Attachment' : ''),
        lastAt: last?.sentAt ?? t.updatedAt,
        unread: messages.filter((m) => m.senderId !== guard.caller.userId && !m.readBy.includes(guard.caller.userId)).length
      };
    });
  return NextResponse.json({ threads });
}

export async function POST(request: Request) {
  const guard = await requireRole(['patient', 'provider']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const otherId = str(body.participantId, 64);
  const topic = str(body.topic ?? 'Consultation chat', 140);
  const contextId = typeof body.contextId === 'string' && body.contextId ? body.contextId : undefined;

  const db = await getDb();
  const other = db.users.find((u) => u.id === otherId);
  if (!other) return NextResponse.json({ error: 'Participant not found.' }, { status: 404 });
  if (other.id === guard.caller.userId) return NextResponse.json({ error: 'Cannot message yourself.' }, { status: 400 });

  const allowed = ['admin', 'provider', 'patient'];
  if (!allowed.includes(other.role)) return NextResponse.json({ error: 'This account cannot use chat.' }, { status: 400 });

  const existing = db.threads.find(
    (t) => t.contextId === contextId && t.participantIds.includes(guard.caller.userId) && t.participantIds.includes(otherId)
  );
  if (existing) return NextResponse.json({ thread: existing });

  const thread = await mutate((db2) => {
    const t: Thread = {
      id: newId(),
      participantIds: [guard.caller.userId, otherId],
      topic,
      contextId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db2.threads.push(t);
    return t;
  });
  return NextResponse.json({ thread }, { status: 201 });
}
