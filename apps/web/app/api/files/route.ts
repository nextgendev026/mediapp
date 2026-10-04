import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { mutate, newId, type Attachment } from '@/lib/server/store';
import { recordAudit } from '@/lib/server/audit';
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES, clientIp, isSameOriginMutation, rateLimit } from '@/lib/server/security';

export const runtime = 'nodejs';

const EXTRA_MIME = ['image/gif', 'image/avif', 'image/heic', 'image/heif', 'image/bmp', 'image/tiff', 'image/x-icon'];
const ALLOWED_MIME = new Set<string>([...ALLOWED_UPLOAD_MIME, ...EXTRA_MIME]);
const MAX_BYTES = Math.min(MAX_UPLOAD_BYTES, 2_000_000);
const VIDEO_MAX = 25 * 1024 * 1024;
const PDF_MAX = 5 * 1024 * 1024;
const ENCRYPTED_SLACK = 1.5;
const KINDS = ['prescription', 'photo', 'document'] as const;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'image/x-icon': '.ico',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/3gpp': '.3gp'
};

function extensionFor(mime: string): string {
  const known = EXTENSIONS[mime];
  if (known) return known;
  const suffix = mime.split('/')[1] ?? '';
  const cleaned = suffix.replace(/[^a-z0-9]/gi, '').slice(0, 8);
  return cleaned ? `.${cleaned}` : '.bin';
}

function sizePolicy(mime: string): { max: number; label: string } {
  if (mime.startsWith('video/')) return { max: VIDEO_MAX, label: '25 MB' };
  if (mime === 'application/pdf') return { max: PDF_MAX, label: '5 MB' };
  return { max: MAX_BYTES, label: '2 MB' };
}

export async function POST(request: Request) {
  const guard = await requireRole(['patient', 'provider', 'pharmacist', 'admin', 'rider']);
  if ('error' in guard) return guard.error;
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });

  const limited = rateLimit(`upload:${clientIp(request)}`, 30, 60_000);
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too many uploads. Try again shortly.' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body.' }, { status: 400 });
  }

  const candidate = form.get('file');
  if (!(candidate instanceof File)) return NextResponse.json({ error: 'A file is required.' }, { status: 400 });
  const file = candidate;
  const encRaw = form.get('enc');
  const encrypted = encRaw === '1' || encRaw === 'true';
  const origMimeRaw = form.get('origMime');
  const origMime = typeof origMimeRaw === 'string' ? origMimeRaw.toLowerCase().trim() : '';
  const mime = origMime || (file.type || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) return NextResponse.json({ error: 'Unsupported file type.' }, { status: 415 });
  if (file.size <= 0) return NextResponse.json({ error: 'File is empty.' }, { status: 400 });
  const policy = sizePolicy(mime);
  const ceiling = encrypted ? Math.ceil(policy.max * ENCRYPTED_SLACK) : policy.max;
  if (file.size > ceiling) return NextResponse.json({ error: `File exceeds the ${policy.label} limit.` }, { status: 413 });

  const kindRaw = form.get('kind');
  const kind = (typeof kindRaw === 'string' && KINDS.includes(kindRaw as (typeof KINDS)[number]) ? kindRaw : 'photo') as Attachment['kind'];

  const storageName = `${newId()}${extensionFor(mime)}`;
  const dir = path.resolve(process.cwd(), '.data', 'uploads');
  await fs.mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, storageName), bytes);

  const attachment = await mutate((db) => {
    const row: Attachment = {
      id: newId(),
      ownerId: guard.caller.userId,
      filename: file.name.slice(0, 180) || 'upload',
      mime,
      size: file.size,
      storageName,
      kind,
      createdAt: new Date().toISOString()
    };
    if (encrypted) {
      row.enc = true;
      row.origMime = mime;
    }
    db.attachments.push(row);
    return row;
  });

  await recordAudit({
    actorId: guard.caller.userId,
    actorRole: guard.caller.role,
    action: 'file_upload',
    resourceType: 'attachment',
    resourceId: attachment.id,
    purpose: 'Secure file upload',
    phiAccessed: kind === 'prescription',
    ip: clientIp(request)
  });

  const { storageName: _ignored, ...safe } = attachment;
  return NextResponse.json({ attachment: safe, id: attachment.id }, { status: 201 });
}
