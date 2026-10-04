import { getDb, mutate, newId, type AuditEvent } from './store';
import { str } from './security';

export interface AuditInput {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string | undefined;
  purpose?: string | undefined;
  phiAccessed: boolean;
  ip?: string | undefined;
  metadata?: Record<string, string> | undefined;
}

export async function recordAudit(input: AuditInput): Promise<AuditEvent> {
  const event: AuditEvent = {
    id: newId(),
    at: new Date().toISOString(),
    actorId: str(input.actorId, 64),
    actorRole: str(input.actorRole, 32),
    action: str(input.action, 64),
    resourceType: str(input.resourceType, 64),
    resourceId: input.resourceId ? str(input.resourceId, 64) : undefined,
    purpose: input.purpose ? str(input.purpose, 160) : undefined,
    phiAccessed: input.phiAccessed,
    ip: input.ip ? str(input.ip, 64) : undefined,
    metadata: input.metadata
  };
  await mutate((db) => {
    db.audit.push(event);
    if (db.audit.length > 5000) db.audit.splice(0, db.audit.length - 5000);
  });
  return event;
}

export interface AuditQuery {
  q?: string | undefined;
  actorRole?: string | undefined;
  action?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
}

export async function listAudit(query: AuditQuery): Promise<{ rows: AuditEvent[]; total: number }> {
  const db = await getDb();
  const q = (query.q ?? '').toLowerCase();
  let rows = db.audit.slice().sort((a, b) => (a.at < b.at ? 1 : -1));
  if (q) {
    rows = rows.filter((e) =>
      [e.action, e.resourceType, e.resourceId, e.actorRole, e.purpose, e.actorId]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }
  if (query.actorRole) rows = rows.filter((e) => e.actorRole === query.actorRole);
  if (query.action) rows = rows.filter((e) => e.action === query.action);
  if (query.from) rows = rows.filter((e) => e.at >= query.from!);
  if (query.to) rows = rows.filter((e) => e.at <= query.to!);
  const total = rows.length;
  const limit = Math.min(Math.max(query.limit ?? 200, 1), 2000);
  return { rows: rows.slice(0, limit), total };
}

export function auditToCsv(rows: AuditEvent[]): string {
  const header = ['timestamp', 'actor_id', 'actor_role', 'action', 'resource_type', 'resource_id', 'purpose', 'phi_accessed', 'ip'];
  const escape = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [r.at, r.actorId, r.actorRole, r.action, r.resourceType, r.resourceId, r.purpose, r.phiAccessed, r.ip].map(escape).join(','));
  return [header.join(','), ...lines].join('\r\n');
}
