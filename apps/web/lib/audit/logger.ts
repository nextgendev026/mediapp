export interface AuditEvent {
  action: string;
  resourceType: string;
  resourceId?: string;
  phiAccessed?: boolean;
  purpose?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditEvent(event: AuditEvent) {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/audit-logger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
  } catch {
    return;
  }
}
