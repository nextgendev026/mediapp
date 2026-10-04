import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionCookieName, verifySession } from '../auth/session';

export interface AppSettings {
  siteName: string;
  tagline: string;
  supportPhone: string;
  supportEmail: string;
  maintenanceMode: boolean;
  registrationOpen: boolean;
  bookingEnabled: boolean;
  chatEnabled: boolean;
  codEnabled: boolean;
  mpesaEnabled: boolean;
  consultationFeeVideo: number;
  consultationFeeChat: number;
  consultationFeeInPerson: number;
  deliveryFeeKes: number;
  lowStockThreshold: number;
  dormantDays: number;
  sessionHours: number;
  currency: string;
  locale: string;
  bannerMessage: string;
  bannerActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

export const SETTINGS_DEFAULTS: AppSettings = {
  siteName: 'AfyaCommerce',
  tagline: "Kenya's health, one tap away",
  supportPhone: '0800 722 000',
  supportEmail: 'support@afyacommerce.co.ke',
  maintenanceMode: false,
  registrationOpen: true,
  bookingEnabled: true,
  chatEnabled: true,
  codEnabled: true,
  mpesaEnabled: true,
  consultationFeeVideo: 1200,
  consultationFeeChat: 800,
  consultationFeeInPerson: 1500,
  deliveryFeeKes: 200,
  lowStockThreshold: 20,
  dormantDays: 60,
  sessionHours: 12,
  currency: 'KES',
  locale: 'en-KE',
  bannerMessage: '',
  bannerActive: false,
  updatedAt: '',
  updatedBy: ''
};

type FieldRule =
  | { kind: 'boolean' }
  | { kind: 'number'; min: number; max: number; integer: boolean }
  | { kind: 'string'; max: number; required: boolean; pattern?: RegExp };

const FIELD_RULES: Record<string, FieldRule> = {
  siteName: { kind: 'string', max: 80, required: true },
  tagline: { kind: 'string', max: 160, required: false },
  supportPhone: { kind: 'string', max: 32, required: true },
  supportEmail: { kind: 'string', max: 120, required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  maintenanceMode: { kind: 'boolean' },
  registrationOpen: { kind: 'boolean' },
  bookingEnabled: { kind: 'boolean' },
  chatEnabled: { kind: 'boolean' },
  codEnabled: { kind: 'boolean' },
  mpesaEnabled: { kind: 'boolean' },
  consultationFeeVideo: { kind: 'number', min: 1, max: 1_000_000, integer: false },
  consultationFeeChat: { kind: 'number', min: 1, max: 1_000_000, integer: false },
  consultationFeeInPerson: { kind: 'number', min: 1, max: 1_000_000, integer: false },
  deliveryFeeKes: { kind: 'number', min: 0, max: 100_000, integer: false },
  lowStockThreshold: { kind: 'number', min: 0, max: 1_000_000, integer: true },
  dormantDays: { kind: 'number', min: 1, max: 3650, integer: true },
  sessionHours: { kind: 'number', min: 1, max: 720, integer: false },
  currency: { kind: 'string', max: 8, required: true },
  locale: { kind: 'string', max: 16, required: true },
  bannerMessage: { kind: 'string', max: 300, required: false },
  bannerActive: { kind: 'boolean' }
};

const SETTINGS_FILE = path.resolve(process.cwd(), '.data/settings.json');
const SERVER_MANAGED_KEYS = new Set(['updatedAt', 'updatedBy']);

export class SettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsValidationError';
  }
}

let cachedSettings: AppSettings | null = null;
let cachedWriteMs = -1;

function coerceKnown(key: string, value: unknown): unknown {
  const rule = FIELD_RULES[key];
  if (!rule) return undefined;
  if (rule.kind === 'boolean') return typeof value === 'boolean' ? value : undefined;
  if (rule.kind === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  return typeof value === 'string' ? value : undefined;
}

function mergeDefaults(parsed: Partial<AppSettings>): AppSettings {
  const merged: Record<string, unknown> = { ...SETTINGS_DEFAULTS };
  for (const [key, value] of Object.entries(parsed)) {
    if (SERVER_MANAGED_KEYS.has(key)) continue;
    const coerced = coerceKnown(key, value);
    if (coerced !== undefined) merged[key] = coerced;
  }
  if (typeof parsed.updatedAt === 'string') merged.updatedAt = parsed.updatedAt;
  if (typeof parsed.updatedBy === 'string') merged.updatedBy = parsed.updatedBy;
  return merged as unknown as AppSettings;
}

export async function getSettings(): Promise<AppSettings> {
  let mtimeMs: number | null = null;
  try {
    const stat = await fs.stat(SETTINGS_FILE);
    mtimeMs = stat.mtimeMs;
  } catch {
    mtimeMs = null;
  }
  if (mtimeMs === null) {
    cachedSettings = null;
    cachedWriteMs = -1;
    return { ...SETTINGS_DEFAULTS };
  }
  if (cachedSettings && mtimeMs === cachedWriteMs) return cachedSettings;
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const merged = mergeDefaults(parsed && typeof parsed === 'object' ? parsed : {});
    cachedSettings = merged;
    cachedWriteMs = mtimeMs;
    return merged;
  } catch {
    if (cachedSettings) return cachedSettings;
    return { ...SETTINGS_DEFAULTS };
  }
}

function validatePartial(raw: Record<string, unknown>): Partial<AppSettings> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const rule = FIELD_RULES[key];
    if (!rule || SERVER_MANAGED_KEYS.has(key)) throw new SettingsValidationError(`Unknown setting: ${key}`);
    if (value === null || value === undefined) throw new SettingsValidationError(`Invalid value for ${key}.`);
    if (rule.kind === 'boolean') {
      if (typeof value !== 'boolean') throw new SettingsValidationError(`${key} must be true or false.`);
      out[key] = value;
    } else if (rule.kind === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new SettingsValidationError(`${key} must be a number.`);
      if (rule.integer && !Number.isInteger(value)) throw new SettingsValidationError(`${key} must be a whole number.`);
      if (value < rule.min || value > rule.max) throw new SettingsValidationError(`${key} must be between ${rule.min} and ${rule.max}.`);
      out[key] = value;
    } else {
      if (typeof value !== 'string') throw new SettingsValidationError(`${key} must be text.`);
      const trimmed = value.trim();
      if (trimmed.length > rule.max) throw new SettingsValidationError(`${key} must be ${rule.max} characters or fewer.`);
      if (rule.required && trimmed.length === 0) throw new SettingsValidationError(`${key} cannot be empty.`);
      if (rule.pattern && trimmed.length > 0 && !rule.pattern.test(trimmed)) throw new SettingsValidationError(`${key} is not a valid value.`);
      out[key] = trimmed;
    }
  }
  return out as unknown as Partial<AppSettings>;
}

export async function saveSettings(partial: Record<string, unknown>, updatedBy: string): Promise<AppSettings> {
  const clean = validatePartial(partial);
  const current = await getSettings();
  const next: AppSettings = {
    ...current,
    ...clean,
    updatedAt: new Date().toISOString(),
    updatedBy: typeof updatedBy === 'string' && updatedBy.trim() ? updatedBy.trim().slice(0, 80) : 'system'
  };
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  const tmp = `${SETTINGS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(next, null, 2), 'utf8');
  await fs.rename(tmp, SETTINGS_FILE);
  cachedSettings = next;
  try {
    const stat = await fs.stat(SETTINGS_FILE);
    cachedWriteMs = stat.mtimeMs;
  } catch {
    cachedWriteMs = -1;
  }
  return next;
}

export async function isMaintenance(): Promise<boolean> {
  const settings = await getSettings();
  return settings.maintenanceMode;
}

export async function maintenanceGuard(): Promise<void> {
  const settings = await getSettings();
  if (!settings.maintenanceMode) return;
  const token = cookies().get(sessionCookieName())?.value;
  const session = await verifySession(token);
  if (session && session.role === 'admin') return;
  redirect('/login?maintenance=1');
}
