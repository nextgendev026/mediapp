import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { getDb } from '@/lib/server/store';
import { recordAudit } from '@/lib/server/audit';
import { buildCsv, buildXlsx, type XlsxSheet } from '@/lib/server/xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Entity = 'users' | 'appointments' | 'encounters' | 'prescriptions' | 'referrals' | 'invoices' | 'payments' | 'orders' | 'messages' | 'audit' | 'admissions' | 'notifications';

const ENTITIES: Entity[] = ['users', 'appointments', 'encounters', 'prescriptions', 'referrals', 'invoices', 'payments', 'orders', 'messages', 'audit', 'admissions', 'notifications'];

interface SheetSpec { title: string; headers: string[]; rows: (string | number | boolean | null | undefined)[][]; }

function inRange(iso: string | undefined, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function nameOf(users: { id: string; fullName: string }[], id?: string): string {
  if (!id) return '';
  return users.find((u) => u.id === id)?.fullName ?? id;
}

async function buildEntitySheet(entity: Entity, from?: string, to?: string): Promise<SheetSpec> {
  const db = await getDb();
  const users = db.users;
  const fmt = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

  switch (entity) {
    case 'users':
      return {
        title: 'Users',
        headers: ['ID', 'Full name', 'Email', 'Phone', 'Role', 'Status', 'County', 'MFA', 'Created at', 'Last login'],
        rows: users
          .filter((u) => inRange(u.createdAt, from, to))
          .map((u) => [u.id, u.fullName, u.email, u.phone, u.role, u.status, fmt(u.county), u.mfa ? 'Yes' : 'No', u.createdAt, fmt(u.lastLoginAt)])
      };
    case 'appointments':
      return {
        title: 'Appointments',
        headers: ['ID', 'Date', 'Time', 'Patient', 'Provider', 'Mode', 'Status', 'Reason', 'Fee KES', 'Invoice ID', 'Created at'],
        rows: db.appointments
          .filter((a) => inRange(a.createdAt, from, to))
          .map((a) => [a.id, a.date, a.time, nameOf(users, a.patientId), nameOf(users, a.providerId), a.mode, a.status, a.reason, a.feeKes, fmt(a.invoiceId), a.createdAt])
      };
    case 'encounters':
      return {
        title: 'Encounters',
        headers: ['ID', 'Date', 'Patient', 'Provider', 'Type', 'Diagnosis', 'Outcome', 'Status', 'Subjective', 'Objective', 'Assessment', 'Plan'],
        rows: db.encounters
          .filter((e) => inRange(e.date, from, to))
          .map((e) => [e.id, e.date, nameOf(users, e.patientId), nameOf(users, e.providerId), e.type, fmt(e.diagnosis), e.outcome, e.status, e.soap.subjective, e.soap.objective, e.soap.assessment, e.soap.plan])
      };
    case 'prescriptions':
      return {
        title: 'Prescriptions',
        headers: ['ID', 'Date', 'Patient', 'Provider', 'Status', 'Items', 'Notes', 'Signed by'],
        rows: db.prescriptions
          .filter((p) => inRange(p.date, from, to))
          .map((p) => [p.id, p.date, nameOf(users, p.patientId), nameOf(users, p.providerId), p.status, p.items.map((i) => `${i.name} ${i.dosage} x${i.quantity}`).join('; '), fmt(p.notes), nameOf(users, p.signedBy)])
      };
    case 'referrals':
      return {
        title: 'Referrals',
        headers: ['ID', 'Date', 'Patient', 'From provider', 'Facility', 'KEPH level', 'Urgency', 'Reason', 'Status'],
        rows: db.referrals
          .filter((r) => inRange(r.date, from, to))
          .map((r) => [r.id, r.date, nameOf(users, r.patientId), nameOf(users, r.fromProviderId), r.toFacility, r.toLevel, r.urgency, r.reason, r.status])
      };
    case 'invoices':
      return {
        title: 'Invoices',
        headers: ['Number', 'Patient', 'Issued at', 'Due at', 'Lines', 'Total KES', 'Paid KES', 'Balance KES', 'Status', 'Source'],
        rows: db.invoices
          .filter((i) => inRange(i.issuedAt, from, to))
          .map((i) => [i.number, nameOf(users, i.patientId), i.issuedAt, i.dueAt, i.lines.map((l) => `${l.description} x${l.qty} @${l.unitPriceKes}`).join(' | '), i.totalKes, i.paidKes, i.totalKes - i.paidKes, i.status, i.sourceType])
      };
    case 'payments':
      return {
        title: 'Payments',
        headers: ['Receipt', 'Patient', 'Invoice', 'Amount KES', 'Method', 'Reference', 'Recorded by', 'Paid at'],
        rows: db.payments
          .filter((p) => inRange(p.paidAt, from, to))
          .map((p) => [p.receiptNo, nameOf(users, p.patientId), p.invoiceId ? (db.invoices.find((i) => i.id === p.invoiceId)?.number ?? p.invoiceId) : '', p.amountKes, p.method, p.reference, nameOf(users, p.recordedBy), p.paidAt])
      };
    case 'orders':
      return {
        title: 'Orders',
        headers: ['ID', 'Patient', 'Status', 'Items', 'Total KES', 'Address', 'Created at'],
        rows: db.orders
          .filter((o) => inRange((o as { createdAt?: string }).createdAt ?? '', from, to))
          .map((o) => {
            const order = o as { id: string; patientId: string; status: string; items?: { name?: string; qty?: number }[]; totalKes?: number; address?: string; landmark?: string; createdAt?: string };
            return [order.id, nameOf(users, order.patientId), order.status, (order.items ?? []).map((it) => `${it.name ?? ''} x${it.qty ?? 1}`).join('; '), fmt(order.totalKes), `${fmt(order.address)} ${fmt(order.landmark)}`.trim(), fmt(order.createdAt)];
          })
      };
    case 'messages':
      return {
        title: 'Messages (metadata)',
        headers: ['ID', 'Thread', 'Sender', 'Sent at', 'Has attachment', 'Text length (encrypted at rest)'],
        rows: db.messages
          .filter((m) => inRange(m.sentAt, from, to))
          .map((m) => [m.id, m.threadId, nameOf(users, m.senderId), m.sentAt, m.attachmentId ? 'Yes' : 'No', (m.text ?? '').length])
      };
    case 'audit':
      return {
        title: 'Audit log',
        headers: ['At', 'Actor', 'Role', 'Action', 'Resource type', 'Resource ID', 'Purpose', 'PHI accessed', 'IP', 'Details'],
        rows: db.audit
          .filter((a) => inRange(a.at, from, to))
          .map((a) => [a.at, nameOf(users, a.actorId), a.actorRole, a.action, a.resourceType, a.resourceId, a.purpose, a.phiAccessed ? 'Yes' : 'No', fmt((a as { ip?: string }).ip), fmt((a as { details?: string }).details)])
      };
    case 'admissions':
      return {
        title: 'Admissions',
        headers: ['ID', 'Patient', 'Ward', 'Bed', 'Admitted at', 'Discharged at', 'Daily rate KES', 'Status'],
        rows: db.admissions
          .filter((a) => inRange(a.admittedAt, from, to))
          .map((a) => [a.id, nameOf(users, a.patientId), a.ward, a.bedNo, a.admittedAt, fmt(a.dischargedAt), a.dailyRateKes, a.status])
      };
    case 'notifications':
      return {
        title: 'Notifications',
        headers: ['ID', 'User', 'Title', 'Body', 'Type', 'Read', 'Created at'],
        rows: db.notifications
          .filter((n) => inRange(n.createdAt, from, to))
          .map((n) => [n.id, nameOf(users, n.userId), n.title, n.body, n.type, n.read ? 'Yes' : 'No', n.createdAt])
      };
  }
}

export async function GET(request: Request) {
  const guard = await requireRole(['admin']);
  if ('error' in guard) return guard.error;

  const url = new URL(request.url);
  const entity = (url.searchParams.get('entity') ?? '') as Entity;
  const format = url.searchParams.get('format') ?? 'xlsx';
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;
  const countOnly = url.searchParams.get('count') === '1';

  if (!ENTITIES.includes(entity)) {
    return NextResponse.json({ error: `Unknown entity. Allowed: ${ENTITIES.join(', ')}` }, { status: 400 });
  }
  if (format !== 'xlsx' && format !== 'csv') {
    return NextResponse.json({ error: 'Format must be xlsx or csv.' }, { status: 400 });
  }
  if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
    return NextResponse.json({ error: 'Dates must be YYYY-MM-DD.' }, { status: 400 });
  }

  const sheet = await buildEntitySheet(entity, from, to);
  if (countOnly) {
    return NextResponse.json({ count: sheet.rows.length, entity, headers: sheet.headers });
  }

  await recordAudit({
    actorId: guard.caller.userId,
    actorRole: guard.caller.role,
    action: 'data_export',
    resourceType: entity,
    resourceId: `${from ?? 'all'}..${to ?? 'all'}`,
    purpose: 'Regulatory data export',
    phiAccessed: true
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `afyacommerce-${entity}-${stamp}.${format}`;

  if (format === 'csv') {
    const csv = buildCsv([sheet.headers, ...sheet.rows]);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      }
    });
  }

  const buffer = buildXlsx([{ name: sheet.title, rows: [sheet.headers, ...sheet.rows] }]);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store'
    }
  });
}
