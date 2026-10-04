import { getDb, mutate, newId, nextNumber, type Invoice, type InvoiceLine, type Payment } from './store';

export interface InvoiceView extends Invoice {
  patientName: string;
  patientPhone: string;
  balanceKes: number;
}

export interface PaymentView extends Payment {
  patientName: string;
  invoiceNumber?: string | undefined;
}

function dayMs(): number {
  return 86_400_000;
}

export function accrualDays(admittedAt: string, dischargedAt?: string): number {
  const start = Date.parse(admittedAt);
  const end = dischargedAt ? Date.parse(dischargedAt) : Date.now();
  if (!Number.isFinite(start)) return 0;
  const days = Math.floor((Math.max(end, start) - start) / dayMs()) + 1;
  return Math.max(1, days);
}

export function accrualTotal(dailyRateKes: number, admittedAt: string, dischargedAt?: string): number {
  return dailyRateKes * accrualDays(admittedAt, dischargedAt);
}

export async function listInvoices(filter: { status?: string; q?: string } = {}): Promise<InvoiceView[]> {
  const db = await getDb();
  const q = (filter.q ?? '').toLowerCase();
  const nameOf = (id: string): string => db.users.find((u) => u.id === id)?.fullName ?? 'Unknown patient';
  const phoneOf = (id: string): string => db.users.find((u) => u.id === id)?.phone ?? '';
  let rows = db.invoices.slice().sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
  if (filter.status) rows = rows.filter((i) => i.status === filter.status);
  if (q) {
    rows = rows.filter((i) => i.number.toLowerCase().includes(q) || nameOf(i.patientId).toLowerCase().includes(q));
  }
  return rows.map((i) => ({
    ...i,
    patientName: nameOf(i.patientId),
    patientPhone: phoneOf(i.patientId),
    balanceKes: i.totalKes - i.paidKes
  }));
}

export async function getInvoice(id: string): Promise<InvoiceView | null> {
  const db = await getDb();
  const invoice = db.invoices.find((i) => i.id === id);
  if (!invoice) return null;
  const patient = db.users.find((u) => u.id === invoice.patientId);
  return {
    ...invoice,
    patientName: patient?.fullName ?? 'Unknown patient',
    patientPhone: patient?.phone ?? '',
    balanceKes: invoice.totalKes - invoice.paidKes
  };
}

export async function listPayments(): Promise<PaymentView[]> {
  const db = await getDb();
  const nameOf = (id: string): string => db.users.find((u) => u.id === id)?.fullName ?? 'Unknown patient';
  return db.payments
    .slice()
    .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1))
    .map((p) => ({
      ...p,
      patientName: nameOf(p.patientId),
      invoiceNumber: db.invoices.find((i) => i.id === p.invoiceId)?.number
    }));
}

export interface CreateInvoiceInput {
  patientId: string;
  lines: InvoiceLine[];
  sourceType: Invoice['sourceType'];
  sourceId?: string;
  dueDays?: number;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice | null> {
  if (input.lines.length === 0) return null;
  return mutate((db) => {
    if (!db.users.some((u) => u.id === input.patientId)) return null;
    const totalKes = input.lines.reduce((sum, line) => sum + line.qty * line.unitPriceKes, 0);
    const now = new Date();
    const invoice: Invoice = {
      id: newId(),
      number: nextNumber(db, 'invoice', 'INV'),
      patientId: input.patientId,
      issuedAt: now.toISOString(),
      dueAt: new Date(now.getTime() + (input.dueDays ?? 14) * dayMs()).toISOString(),
      lines: input.lines,
      totalKes,
      paidKes: 0,
      status: 'issued',
      sourceType: input.sourceType,
      sourceId: input.sourceId
    };
    db.invoices.push(invoice);
    return invoice;
  });
}

export async function recordPayment(input: {
  invoiceId?: string;
  patientId: string;
  amountKes: number;
  method: Payment['method'];
  reference: string;
  recordedBy: string;
}): Promise<Payment | null> {
  if (!Number.isFinite(input.amountKes) || input.amountKes <= 0) return null;
  return mutate((db) => {
    const invoice = input.invoiceId ? db.invoices.find((i) => i.id === input.invoiceId) : undefined;
    if (input.invoiceId && !invoice) return null;
    const payment: Payment = {
      id: newId(),
      invoiceId: invoice?.id,
      patientId: input.patientId,
      amountKes: Math.round(input.amountKes),
      method: input.method,
      reference: input.reference || 'MANUAL',
      receiptNo: nextNumber(db, 'receipt', 'RCT'),
      paidAt: new Date().toISOString(),
      recordedBy: input.recordedBy
    };
    db.payments.push(payment);
    if (invoice) {
      invoice.paidKes += payment.amountKes;
      invoice.status = invoice.paidKes >= invoice.totalKes ? 'paid' : 'partially_paid';
    }
    return payment;
  });
}

export interface AgingBucket { label: string; amountKes: number; count: number; }

export async function receivablesAging(): Promise<{ total: AgingBucket[]; byPatient: { patientId: string; patientName: string; balanceKes: number; oldestDueAt: string; daysOverdue: number }[] }> {
  const db = await getDb();
  const now = Date.now();
  const buckets: AgingBucket[] = [
    { label: 'Not due', amountKes: 0, count: 0 },
    { label: '1-30 days', amountKes: 0, count: 0 },
    { label: '31-60 days', amountKes: 0, count: 0 },
    { label: '60+ days', amountKes: 0, count: 0 }
  ];
  const byPatient = new Map<string, { patientId: string; patientName: string; balanceKes: number; oldestDueAt: string; daysOverdue: number }>();
  for (const inv of db.invoices) {
    if (inv.status === 'void') continue;
    const balance = inv.totalKes - inv.paidKes;
    if (balance <= 0) continue;
    const overdueDays = Math.floor((now - Date.parse(inv.dueAt)) / dayMs());
    const bucket = overdueDays <= 0 ? buckets[0]! : overdueDays <= 30 ? buckets[1]! : overdueDays <= 60 ? buckets[2]! : buckets[3]!;
    bucket.amountKes += balance;
    bucket.count += 1;
    const existing = byPatient.get(inv.patientId);
    if (!existing || inv.dueAt < existing.oldestDueAt) {
      byPatient.set(inv.patientId, {
        patientId: inv.patientId,
        patientName: db.users.find((u) => u.id === inv.patientId)?.fullName ?? 'Unknown',
        balanceKes: 0,
        oldestDueAt: inv.dueAt,
        daysOverdue: Math.max(0, overdueDays)
      });
    }
    const entry = byPatient.get(inv.patientId)!;
    entry.balanceKes += balance;
  }
  return {
    total: buckets,
    byPatient: Array.from(byPatient.values()).sort((a, b) => b.balanceKes - a.balanceKes)
  };
}
