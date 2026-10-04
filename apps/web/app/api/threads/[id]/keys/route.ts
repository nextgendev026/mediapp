import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb, mutate, type Thread } from '@/lib/server/store';
import { isSameOriginMutation } from '@/lib/server/security';

export const runtime = 'nodejs';

const PUBLIC_KEY_PATTERN = /^[A-Za-z0-9+/]{20,300}={0,2}$/;

interface KeyEntry {
  userId: string;
  publicKey: string;
  at: string;
}

async function requireThread(threadId: string, userId: string): Promise<{ thread: Thread } | { error: NextResponse }> {
  const db = await getDb();
  const thread = db.threads.find((t) => t.id === threadId);
  if (!thread) return { error: NextResponse.json({ error: 'Thread not found.' }, { status: 404 }) };
  if (!thread.participantIds.includes(userId)) {
    return { error: NextResponse.json({ error: 'Not a participant in this thread.' }, { status: 403 }) };
  }
  return { thread };
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['patient', 'provider', 'pharmacist', 'admin']);
  if ('error' in guard) return guard.error;
  const found = await requireThread(params.id, guard.caller.userId);
  if ('error' in found) return found.error;
  const publicKeys: KeyEntry[] = (found.thread.publicKeys ?? []).map((entry) => ({
    userId: entry.userId,
    publicKey: entry.publicKey,
    at: entry.at
  }));
  return NextResponse.json({ publicKeys, me: guard.caller.userId });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['patient', 'provider', 'pharmacist', 'admin']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });
  const found = await requireThread(params.id, guard.caller.userId);
  if ('error' in found) return found.error;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const publicKey = typeof body.publicKey === 'string' ? body.publicKey.trim() : '';
  if (!PUBLIC_KEY_PATTERN.test(publicKey)) {
    return NextResponse.json({ error: 'Invalid public key.' }, { status: 400 });
  }

  const saved = await mutate((db) => {
    const thread = db.threads.find((t) => t.id === params.id);
    if (!thread) return null;
    const next: KeyEntry[] = (thread.publicKeys ?? [])
      .filter((entry) => entry.userId !== guard.caller.userId)
      .map((entry) => ({ userId: entry.userId, publicKey: entry.publicKey, at: entry.at }));
    next.push({ userId: guard.caller.userId, publicKey, at: new Date().toISOString() });
    thread.publicKeys = next;
    return next;
  });
  if (!saved) return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });

  return NextResponse.json({ publicKeys: saved, me: guard.caller.userId }, { status: 201 });
}
