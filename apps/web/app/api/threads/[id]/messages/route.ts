import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate, newId, type Message } from '@/lib/server/store';
import { isSameOriginMutation, str } from '@/lib/server/security';
import { getSettings } from '@/lib/server/settings';
import { isEnvelope } from '@/lib/chat/crypto';

export const runtime = 'nodejs';

async function requireParticipant(threadId: string, userId: string): Promise<{ ok: true } | { error: NextResponse }> {
  const db = await getDb();
  const thread = db.threads.find((t) => t.id === threadId);
  if (!thread) return { error: NextResponse.json({ error: 'Thread not found.' }, { status: 404 }) };
  if (!thread.participantIds.includes(userId)) {
    return { error: NextResponse.json({ error: 'Not a participant in this thread.' }, { status: 403 }) };
  }
  return { ok: true };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['patient', 'provider', 'pharmacist', 'admin', 'rider']);
  if ('error' in guard) return guard.error;
  const check = await requireParticipant(params.id, guard.caller.userId);
  if ('error' in check) return check.error;

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 100));
  const db = await getDb();
  const messages = db.messages
    .filter((m) => m.threadId === params.id)
    .slice(-limit)
    .map((m) => ({
      ...m,
      senderName: db.users.find((u) => u.id === m.senderId)?.fullName ?? 'Unknown',
      senderRole: db.users.find((u) => u.id === m.senderId)?.role ?? 'patient',
      attachment: m.attachmentId
        ? (() => {
            const a = db.attachments.find((x) => x.id === m.attachmentId);
            return a ? { id: a.id, filename: a.filename, mime: a.mime, size: a.size, kind: a.kind, enc: a.enc, origMime: a.origMime } : null;
          })()
        : null
    }));
  return NextResponse.json({ messages });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['patient', 'provider', 'pharmacist', 'admin']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });
  const chatSettings = await getSettings();
  if (!chatSettings.chatEnabled) return NextResponse.json({ error: 'Chat is temporarily disabled.' }, { status: 409 });
  const check = await requireParticipant(params.id, guard.caller.userId);
  if ('error' in check) return check.error;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? str(body.text, 60_000).trim() : '';
  const attachmentId = typeof body.attachmentId === 'string' && body.attachmentId ? body.attachmentId : undefined;
  if (!text && !attachmentId) return NextResponse.json({ error: 'Message is empty.' }, { status: 400 });

  const db = await getDb();
  if (attachmentId) {
    const attachment = db.attachments.find((a) => a.id === attachmentId);
    if (!attachment || attachment.ownerId !== guard.caller.userId) {
      return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });
    }
  }

  const message = await mutate((db2) => {
    const m: Message = {
      id: newId(),
      threadId: params.id,
      senderId: guard.caller.userId,
      sentAt: new Date().toISOString(),
      text: text || undefined,
      attachmentId,
      readBy: [guard.caller.userId]
    };
    db2.messages.push(m);
    const thread = db2.threads.find((t) => t.id === params.id);
    if (thread) thread.updatedAt = m.sentAt;
    return m;
  });

  const thread = db.threads.find((t) => t.id === params.id);
  const otherId = thread?.participantIds.find((id) => id !== guard.caller.userId);
  const signalOnly = text.startsWith('@@SIGNAL@@');
  const preview = text && !signalOnly && !isEnvelope(text) ? text.slice(0, 80) : '';
  const detail = preview ? `: ${preview}` : text ? '' : ' with an attachment';
  if (otherId && !signalOnly) {
    const { notify } = await import('@/lib/server/notify');
    await notify({
      userId: otherId,
      title: 'New message',
      body: `${db.users.find((u) => u.id === guard.caller.userId)?.fullName ?? 'Someone'} sent you a message${detail}.`,
      type: 'system',
      href: guard.caller.role === 'patient' ? '/dashboard' : '/provider'
    });
  }

  return NextResponse.json({ message }, { status: 201 });
}
