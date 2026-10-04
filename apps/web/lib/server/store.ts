import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { VisitStage } from '../workflow';

export type { VisitStage } from '../workflow';
export { stageOf, nextStage, stageIndex, isVisitStage, VISIT_STAGES, STAGE_LABELS } from '../workflow';

export type UserRole = 'patient' | 'provider' | 'pharmacist' | 'admin' | 'rider';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  phone: string;
  status: 'active' | 'suspended';
  mfa: boolean;
  createdAt: string;
  lastLoginAt?: string | undefined;
  county?: string | undefined;
  gender?: string | undefined;
  dob?: string | undefined;
  specialty?: string | undefined;
  licenseNo?: string | undefined;
  allergies?: string[] | undefined;
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  date: string;
  time: string;
  mode: 'video' | 'chat' | 'in_person';
  status: 'booked' | 'completed' | 'cancelled' | 'no_show';
  reason: string;
  feeKes: number;
  createdAt: string;
  invoiceId?: string | undefined;
  stage?: VisitStage | undefined;
  assignedTo?: string | undefined;
}

export interface SoapNote { subjective: string; objective: string; assessment: string; plan: string; }

export interface LabOrder {
  id: string;
  encounterId?: string | undefined;
  appointmentId?: string | undefined;
  patientId: string;
  orderedBy: string;
  modality: 'laboratory' | 'imaging';
  test: string;
  clinicalQuestion: string;
  priceKes: number;
  status: 'ordered' | 'in_progress' | 'resulted';
  result?: string | undefined;
  interpretation?: string | undefined;
  createdAt: string;
  resultedAt?: string | undefined;
}

export interface Encounter {
  id: string;
  appointmentId?: string | undefined;
  patientId: string;
  providerId: string;
  date: string;
  type: 'consultation' | 'follow_up' | 'inpatient' | 'referral_review';
  soap: SoapNote;
  diagnosis?: string | undefined;
  outcome: 'treatment' | 'prescription' | 'referral' | 'lab_orders' | 'admission';
  status: 'open' | 'closed';
  invoiceId?: string | undefined;
}

export interface PrescriptionItem {
  name: string; dosage: string; frequency: string; duration: string; quantity: number; instructions: string;
}

export interface Prescription {
  id: string;
  encounterId?: string | undefined;
  patientId: string;
  providerId: string;
  date: string;
  items: PrescriptionItem[];
  status: 'pending_approval' | 'approved' | 'dispensed' | 'rejected';
  notes?: string | undefined;
  signedBy?: string | undefined;
  invoiceId?: string | undefined;
}

export interface Referral {
  id: string;
  encounterId?: string | undefined;
  patientId: string;
  fromProviderId: string;
  toFacility: string;
  toLevel: 'Level 4' | 'Level 5' | 'Level 6' | 'specialist clinic';
  urgency: 'routine' | 'urgent' | 'emergency';
  reason: string;
  clinicalSummary: string;
  status: 'issued' | 'accepted' | 'completed';
  date: string;
}

export interface Thread {
  id: string;
  participantIds: string[];
  topic: string;
  contextId?: string | undefined;
  createdAt: string;
  updatedAt: string;
  publicKeys?: { userId: string; publicKey: string; at: string }[] | undefined;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  sentAt: string;
  text?: string | undefined;
  attachmentId?: string | undefined;
  readBy: string[];
}

export interface Attachment {
  id: string;
  ownerId: string;
  filename: string;
  mime: string;
  size: number;
  storageName: string;
  kind: 'prescription' | 'photo' | 'document';
  createdAt: string;
  enc?: boolean | undefined;
  origMime?: string | undefined;
}

export interface InvoiceLine { description: string; qty: number; unitPriceKes: number; }

export interface Invoice {
  id: string;
  number: string;
  patientId: string;
  issuedAt: string;
  dueAt: string;
  lines: InvoiceLine[];
  totalKes: number;
  paidKes: number;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';
  sourceType: 'consultation' | 'order' | 'admission' | 'pharmacy' | 'manual';
  sourceId?: string | undefined;
}

export interface Payment {
  id: string;
  invoiceId?: string | undefined;
  patientId: string;
  amountKes: number;
  method: 'mpesa' | 'card' | 'cash' | 'sha';
  reference: string;
  receiptNo: string;
  paidAt: string;
  recordedBy: string;
}

export interface Admission {
  id: string;
  patientId: string;
  ward: string;
  bedNo: string;
  admittedAt: string;
  dischargedAt?: string | undefined;
  dailyRateKes: number;
  status: 'active' | 'discharged';
}

export interface AuditEvent {
  id: string;
  at: string;
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

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'appointment' | 'payment' | 'prescription' | 'account' | 'system';
  href?: string | undefined;
  read: boolean;
  createdAt: string;
}

export interface LocalOrderItem { slug: string; name: string; price: number; quantity: number; requiresPrescription: boolean; }

export interface LocalOrder {
  id: string;
  number: string;
  patientId: string;
  createdAt: string;
  items: LocalOrderItem[];
  subtotalKes: number;
  deliveryFeeKes: number;
  totalKes: number;
  status: 'pending' | 'confirmed' | 'dispatched' | 'in_transit' | 'delivered' | 'failed';
  county: string;
  landmark: string;
  method: 'boda' | 'pickup_point' | 'clinic_collection';
  invoiceId?: string | undefined;
}

export interface Database {
  version: number;
  users: UserRecord[];
  appointments: Appointment[];
  encounters: Encounter[];
  prescriptions: Prescription[];
  referrals: Referral[];
  threads: Thread[];
  messages: Message[];
  attachments: Attachment[];
  invoices: Invoice[];
  payments: Payment[];
  admissions: Admission[];
  audit: AuditEvent[];
  notifications: AppNotification[];
  orders: LocalOrder[];
  labOrders: LabOrder[];
  counters: Record<string, number>;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

let cache: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function emptyDb(): Database {
  return {
    version: 1,
    users: [],
    appointments: [],
    encounters: [],
    prescriptions: [],
    referrals: [],
    threads: [],
    messages: [],
    attachments: [],
    invoices: [],
    payments: [],
    admissions: [],
    audit: [],
    notifications: [],
    orders: [],
    labOrders: [],
    counters: {}
  };
}

async function persist(db: Database): Promise<void> {
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(db), 'utf8');
  await fs.rename(tmp, DB_FILE);
}

function scheduleWrite(db: Database): void {
  const snapshot = db;
  writeQueue = writeQueue.then(async () => {
    try {
      await persist(snapshot);
    } catch (error) {
      console.error('[store] persist failed', error);
    }
  });
}

export async function getDb(): Promise<Database> {
  if (cache) return cache;
  let parsed: Database | null = null;
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    parsed = JSON.parse(raw) as Database;
  } catch {
    parsed = null;
  }
  const db = parsed && parsed.version === 1 ? { ...emptyDb(), ...parsed } : emptyDb();
  cache = db;
  if (!parsed) {
    const { buildSeed } = await import('./seed');
    const seed = await buildSeed();
    seedInto(db, seed);
    scheduleWrite(db);
  }
  return db;
}

function seedInto(db: Database, seed: Database): void {
  for (const key of Object.keys(seed) as (keyof Database)[]) {
    if (key === 'version') continue;
    const current = db[key];
    const incoming = seed[key];
    if (Array.isArray(current) && Array.isArray(incoming) && current.length === 0) {
      (db[key] as unknown[]).push(...incoming);
    } else if (key === 'counters' && incoming && typeof incoming === 'object') {
      db.counters = { ...(incoming as Record<string, number>), ...db.counters };
    }
  }
}

export async function mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const db = await getDb();
  const result = await fn(db);
  scheduleWrite(db);
  return result;
}

export async function whenFlushed(): Promise<void> {
  await writeQueue;
}

export function newId(): string {
  return randomUUID();
}

export function nextNumber(db: Database, kind: string, prefix: string): string {
  const n = (db.counters[kind] ?? 0) + 1;
  db.counters[kind] = n;
  return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(6, '0')}`;
}
