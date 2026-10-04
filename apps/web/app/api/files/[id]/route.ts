import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';

export const runtime = 'nodejs';

function encodeFilename(name: string): string {
  const ascii = name.replace(/["\\]/g, '_').replace(/[^\x20-\x7E]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['patient', 'provider', 'pharmacist', 'admin', 'rider']);
  if ('error' in guard) return guard.error;

  const notFound = () => NextResponse.json({ error: 'File not found.' }, { status: 404 });

  const db = await getDb();
  const attachment = db.attachments.find((a) => a.id === params.id);
  if (!attachment) return notFound();

  const isOwner = attachment.ownerId === guard.caller.userId;
  const isAdmin = guard.caller.role === 'admin';
  const isParticipant = db.threads.some(
    (t) => t.participantIds.includes(guard.caller.userId) && db.messages.some((m) => m.threadId === t.id && m.attachmentId === attachment.id)
  );
  if (!isOwner && !isAdmin && !isParticipant) return notFound();

  const dir = path.resolve(process.cwd(), '.data', 'uploads');
  const filePath = path.join(dir, attachment.storageName);
  try {
    await fs.access(filePath);
  } catch {
    return notFound();
  }

  const stream = createReadStream(filePath);
  const web = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
  return new NextResponse(web, {
    status: 200,
    headers: {
      'Content-Type': attachment.mime,
      'Content-Length': String(attachment.size),
      'Content-Disposition': encodeFilename(attachment.filename),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store'
    }
  });
}
