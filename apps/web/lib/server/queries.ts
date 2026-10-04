import { getDb, type UserRecord, type UserRole } from './store';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string;
  status: 'active' | 'suspended';
  mfa: boolean;
  createdAt: string;
  lastLoginAt?: string | undefined;
  county?: string | undefined;
  specialty?: string | undefined;
  licenseNo?: string | undefined;
  allergies?: string[] | undefined;
}

export function toPublicUser(u: UserRecord): PublicUser {
  return {
    id: u.id, email: u.email, fullName: u.fullName, role: u.role, phone: u.phone,
    status: u.status, mfa: u.mfa, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
    county: u.county, specialty: u.specialty, licenseNo: u.licenseNo, allergies: u.allergies
  };
}

export interface UserListQuery {
  q?: string | undefined;
  role?: UserRole | '' | undefined;
  status?: 'active' | 'suspended' | '' | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export async function listUsers(query: UserListQuery): Promise<{ rows: PublicUser[]; total: number; page: number; pageCount: number }> {
  const db = await getDb();
  const q = (query.q ?? '').toLowerCase().trim();
  let rows = db.users.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (q) {
    rows = rows.filter((u) =>
      [u.fullName, u.email, u.phone, u.county].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }
  if (query.role) rows = rows.filter((u) => u.role === query.role);
  if (query.status) rows = rows.filter((u) => u.status === query.status);
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);
  const page = Math.max(query.page ?? 1, 1);
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const slice = rows.slice((page - 1) * pageSize, page * pageSize);
  return { rows: slice.map(toPublicUser), total, page, pageCount };
}

export interface AdminMetrics {
  users: { total: number; active: number; suspended: number; byRole: Record<string, number> };
  clinical: { appointments: number; upcoming: number; encounters: number; prescriptions: number; referrals: number };
  commerce: { orders: number; openOrders: number; delivered: number };
  finance: { revenueKes: number; invoicedKes: number; outstandingKes: number; dormantAccounts: number };
  security: { auditEvents24h: number; failedLogins24h: number; phiReads24h: number };
  activity: { unreadNotifications: number; openThreads: number };
}

export async function computeDormantUserIds(days = 60): Promise<{ userId: string; reason: string; lastActivity: string }[]> {
  const db = await getDb();
  const cutoff = Date.now() - days * 86_400_000;
  const lastActivity = new Map<string, string>();
  const bump = (userId: string, at: string | undefined): void => {
    if (!at) return;
    const prev = lastActivity.get(userId);
    if (!prev || prev < at) lastActivity.set(userId, at);
  };
  for (const a of db.appointments) bump(a.patientId, a.createdAt);
  for (const e of db.encounters) bump(e.patientId, e.date);
  for (const o of db.orders) bump(o.patientId, o.createdAt);
  for (const m of db.messages) bump(m.senderId, m.sentAt);
  for (const u of db.users) bump(u.id, u.lastLoginAt ?? u.createdAt);
  const outstanding = new Map<string, number>();
  for (const inv of db.invoices) {
    const due = inv.totalKes - inv.paidKes;
    if (due > 0 && inv.status !== 'void') outstanding.set(inv.patientId, (outstanding.get(inv.patientId) ?? 0) + due);
  }
  const flagged: { userId: string; reason: string; lastActivity: string }[] = [];
  for (const [userId, balance] of outstanding) {
    const last = lastActivity.get(userId) ?? '';
    const lastMs = last ? Date.parse(last) : 0;
    if (lastMs < cutoff) {
      flagged.push({ userId, reason: `Balance Ksh ${balance.toLocaleString('en-KE')} unpaid, inactive ${Math.floor((Date.now() - lastMs) / 86_400_000)} days`, lastActivity: last || 'never' });
    }
  }
  return flagged.sort((a, b) => (a.lastActivity < b.lastActivity ? -1 : 1));
}

export async function adminMetrics(): Promise<AdminMetrics> {
  const db = await getDb();
  const dayAgo = Date.now() - 86_400_000;
  const isoDayAgo = new Date(dayAgo).toISOString();
  const byRole: Record<string, number> = {};
  for (const u of db.users) byRole[u.role] = (byRole[u.role] ?? 0) + 1;
  const revenueKes = db.payments.reduce((sum, p) => sum + p.amountKes, 0);
  const invoicedKes = db.invoices.filter((i) => i.status !== 'void').reduce((sum, i) => sum + i.totalKes, 0);
  const outstandingKes = db.invoices.filter((i) => i.status !== 'void').reduce((sum, i) => sum + (i.totalKes - i.paidKes), 0);
  const dormant = await computeDormantUserIds();
  return {
    users: {
      total: db.users.length,
      active: db.users.filter((u) => u.status === 'active').length,
      suspended: db.users.filter((u) => u.status === 'suspended').length,
      byRole
    },
    clinical: {
      appointments: db.appointments.length,
      upcoming: db.appointments.filter((a) => a.status === 'booked' && a.date >= new Date().toISOString().slice(0, 10)).length,
      encounters: db.encounters.length,
      prescriptions: db.prescriptions.length,
      referrals: db.referrals.length
    },
    commerce: {
      orders: db.orders.length,
      openOrders: db.orders.filter((o) => !['delivered', 'failed'].includes(o.status)).length,
      delivered: db.orders.filter((o) => o.status === 'delivered').length
    },
    finance: { revenueKes, invoicedKes, outstandingKes, dormantAccounts: dormant.length },
    security: {
      auditEvents24h: db.audit.filter((a) => a.at >= isoDayAgo).length,
      failedLogins24h: db.audit.filter((a) => a.action === 'auth_login_failed' && a.at >= isoDayAgo).length,
      phiReads24h: db.audit.filter((a) => a.phiAccessed && a.at >= isoDayAgo).length
    },
    activity: {
      unreadNotifications: db.notifications.filter((n) => !n.read).length,
      openThreads: db.threads.length
    }
  };
}

export interface UserDetail extends PublicUser {
  appointments: { id: string; date: string; time: string; status: string; provider: string; reason: string }[];
  orders: { id: string; number: string; createdAt: string; totalKes: number; status: string }[];
  invoices: { id: string; number: string; issuedAt: string; totalKes: number; paidKes: number; status: string }[];
  recentAudit: { id: string; at: string; action: string; resourceType: string; purpose?: string | undefined; phiAccessed: boolean }[];
}

export async function getUserDetail(id: string): Promise<UserDetail | null> {
  const db = await getDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
  const name = (uid: string): string => db.users.find((x) => x.id === uid)?.fullName ?? 'Unknown';
  return {
    ...toPublicUser(user),
    appointments: db.appointments
      .filter((a) => a.patientId === id || a.providerId === id)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 10)
      .map((a) => ({ id: a.id, date: a.date, time: a.time, status: a.status, provider: name(a.providerId), reason: a.reason })),
    orders: db.orders
      .filter((o) => o.patientId === id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 10)
      .map((o) => ({ id: o.id, number: o.number, createdAt: o.createdAt, totalKes: o.totalKes, status: o.status })),
    invoices: db.invoices
      .filter((i) => i.patientId === id)
      .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1))
      .slice(0, 10)
      .map((i) => ({ id: i.id, number: i.number, issuedAt: i.issuedAt, totalKes: i.totalKes, paidKes: i.paidKes, status: i.status })),
    recentAudit: db.audit
      .filter((a) => a.actorId === id || a.resourceId === id)
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 15)
      .map((a) => ({ id: a.id, at: a.at, action: a.action, resourceType: a.resourceType, purpose: a.purpose, phiAccessed: a.phiAccessed }))
  };
}
