import { NextResponse } from 'next/server';
import type { AuditEvent } from '@/lib/audit/logger';

const allowedActions = new Set(['phi_access', 'phi_create', 'phi_update', 'phi_export', 'phi_delete', 'auth_login', 'auth_logout', 'consent_update', 'order_view', 'order_create', 'payment_initiate', 'prescription_sign']);

export async function POST(request: Request) {
  let event: AuditEvent;
  try {
    event = (await request.json()) as AuditEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!event || typeof event.action !== 'string' || typeof event.resourceType !== 'string') {
    return NextResponse.json({ error: 'action and resourceType are required' }, { status: 422 });
  }

  if (!allowedActions.has(event.action)) {
    return NextResponse.json({ error: `Unsupported audit action: ${event.action}` }, { status: 422 });
  }

  const record = {
    id: crypto.randomUUID(),
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId ?? null,
    phiAccessed: event.phiAccessed === true,
    purpose: event.purpose ?? null,
    metadata: event.metadata ?? null,
    recordedAt: new Date().toISOString()
  };

  return NextResponse.json({ accepted: true, record }, { status: 202 });
}
