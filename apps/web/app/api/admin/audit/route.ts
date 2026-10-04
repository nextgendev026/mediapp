import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { auditToCsv, listAudit, recordAudit } from '@/lib/server/audit';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const guard = await requireRole(['admin']);
  if ('error' in guard) return guard.error;
  const url = new URL(request.url);
  const query = {
    q: url.searchParams.get('q') ?? '',
    actorRole: url.searchParams.get('role') ?? '',
    action: url.searchParams.get('action') ?? '',
    from: url.searchParams.get('from') ?? '',
    to: url.searchParams.get('to') ?? ''
  };

  if (url.searchParams.get('export') === 'csv') {
    const result = await listAudit({ ...query, limit: 2000 });
    await recordAudit({
      actorId: guard.caller.userId, actorRole: guard.caller.role, action: 'audit_export',
      resourceType: 'audit_log', purpose: 'Compliance reporting', phiAccessed: false,
      metadata: { rows: String(result.total) }
    });
    const csv = auditToCsv(result.rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store'
      }
    });
  }

  const result = await listAudit({ ...query, limit: Number(url.searchParams.get('limit') ?? '200') || 200 });
  return NextResponse.json(result);
}
