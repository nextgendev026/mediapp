'use client';

import { useState } from 'react';
import { AlertTriangle, Save, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AppSettings } from '@/lib/server/settings';

type SectionKey = 'general' | 'features' | 'commerce' | 'governance';
type SectionStatus = { tone: 'success' | 'error'; message: string } | null;

interface SectionDef {
  key: SectionKey;
  eyebrow: string;
  title: string;
  description: string;
  fields: (keyof AppSettings)[];
}

const SECTIONS: SectionDef[] = [
  {
    key: 'general',
    eyebrow: 'Identity',
    title: 'General',
    description: 'How the platform identifies itself to patients and partners.',
    fields: ['siteName', 'tagline', 'supportPhone', 'supportEmail', 'currency', 'locale']
  },
  {
    key: 'features',
    eyebrow: 'Feature toggles',
    title: 'Feature toggles',
    description: 'Turn platform capabilities on or off for everyone, in real time.',
    fields: ['maintenanceMode', 'registrationOpen', 'bookingEnabled', 'chatEnabled', 'mpesaEnabled', 'codEnabled', 'bannerActive', 'bannerMessage']
  },
  {
    key: 'commerce',
    eyebrow: 'Pricing',
    title: 'Commerce',
    description: 'Consultation pricing, delivery, and inventory thresholds.',
    fields: ['consultationFeeVideo', 'consultationFeeChat', 'consultationFeeInPerson', 'deliveryFeeKes', 'lowStockThreshold']
  },
  {
    key: 'governance',
    eyebrow: 'Governance',
    title: 'Governance',
    description: 'Account dormancy and session policy for compliance reviews.',
    fields: ['dormantDays', 'sessionHours']
  }
];

const BOOLEAN_FIELDS = new Set<string>(['maintenanceMode', 'registrationOpen', 'bookingEnabled', 'chatEnabled', 'codEnabled', 'mpesaEnabled', 'bannerActive']);
const NUMBER_FIELDS = new Set<string>(['consultationFeeVideo', 'consultationFeeChat', 'consultationFeeInPerson', 'deliveryFeeKes', 'lowStockThreshold', 'dormantDays', 'sessionHours']);

const FIELD_LABELS: Record<string, string> = {
  siteName: 'Site name',
  tagline: 'Tagline',
  supportPhone: 'Support phone',
  supportEmail: 'Support email',
  currency: 'Currency',
  locale: 'Locale',
  maintenanceMode: 'Maintenance mode',
  registrationOpen: 'Open registration',
  bookingEnabled: 'Online booking',
  chatEnabled: 'Patient chat',
  mpesaEnabled: 'M-PESA payments',
  codEnabled: 'Cash on delivery',
  bannerActive: 'Show announcement banner',
  bannerMessage: 'Announcement message',
  consultationFeeVideo: 'Video consultation fee (KES)',
  consultationFeeChat: 'Chat consultation fee (KES)',
  consultationFeeInPerson: 'In-person consultation fee (KES)',
  deliveryFeeKes: 'Default delivery fee (KES)',
  lowStockThreshold: 'Low stock threshold (units)',
  dormantDays: 'Dormant account after (days)',
  sessionHours: 'Session lifetime (hours)'
};

const FIELD_HINTS: Record<string, string> = {
  supportPhone: 'Shown on login, help, and maintenance notices.',
  bannerMessage: 'Visible to all users while the banner is active.',
  lowStockThreshold: 'Items at or below this level are flagged as low stock.',
  dormantDays: 'Accounts inactive for this long appear in dormant reviews.',
  sessionHours: 'How long a signed-in session stays valid.'
};

function textOf(values: Partial<AppSettings>, key: keyof AppSettings): string {
  const value = values[key];
  return typeof value === 'string' ? value : '';
}

function numOf(values: Partial<AppSettings>, key: keyof AppSettings): string {
  const value = values[key];
  return typeof value === 'number' ? String(value) : '';
}

export function SettingsPanel({ initial }: { initial: AppSettings }) {
  const [values, setValues] = useState<Partial<AppSettings>>({ ...initial });
  const [dirty, setDirty] = useState<Set<keyof AppSettings>>(new Set());
  const [statuses, setStatuses] = useState<Record<SectionKey, SectionStatus>>({ general: null, features: null, commerce: null, governance: null });
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const [maintenanceAck, setMaintenanceAck] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<{ by: string; at: string }>({ by: initial.updatedBy, at: initial.updatedAt });

  function markChanged(key: keyof AppSettings, value: string | number | boolean) {
    setValues((prev) => ({ ...prev, [key]: value }) as Partial<AppSettings>);
    setDirty((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setStatuses((prev) => ({ ...prev, general: null, features: null, commerce: null, governance: null }));
  }

  async function saveSection(section: SectionDef) {
    const payload: Record<string, unknown> = {};
    for (const field of section.fields) {
      if (!dirty.has(field)) continue;
      const value = values[field];
      if (NUMBER_FIELDS.has(String(field)) && typeof value !== 'number') {
        setStatuses((prev) => ({ ...prev, [section.key]: { tone: 'error', message: `${FIELD_LABELS[String(field)] ?? String(field)} needs a number.` } }));
        return;
      }
      payload[field] = value;
    }
    if (section.key === 'features' && payload.maintenanceMode === true && !maintenanceAck) {
      setStatuses((prev) => ({ ...prev, features: { tone: 'error', message: 'Confirm you understand maintenance blocks non-admin users before enabling it.' } }));
      return;
    }
    if (Object.keys(payload).length === 0) {
      setStatuses((prev) => ({ ...prev, [section.key]: { tone: 'success', message: 'No changes to save in this section.' } }));
      return;
    }
    setSaving(section.key);
    setStatuses((prev) => ({ ...prev, [section.key]: null }));
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as { settings?: AppSettings; error?: string };
      if (!res.ok || !data.settings) throw new Error(data.error || 'Could not save settings.');
      setValues({ ...data.settings });
      setLastUpdated({ by: data.settings.updatedBy, at: data.settings.updatedAt });
      setDirty((prev) => {
        const next = new Set(prev);
        for (const field of section.fields) next.delete(field);
        return next;
      });
      if (data.settings.maintenanceMode) setMaintenanceAck(true);
      setStatuses((prev) => ({ ...prev, [section.key]: { tone: 'success', message: 'Saved.' } }));
    } catch (error) {
      setStatuses((prev) => ({ ...prev, [section.key]: { tone: 'error', message: error instanceof Error ? error.message : 'Could not save settings.' } }));
    } finally {
      setSaving(null);
    }
  }

  const dirtyCount = dirty.size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-gray-200)] bg-white px-4 py-3">
        <p className="text-sm font-semibold text-[var(--color-gray-700)]">{dirtyCount > 0 ? `${dirtyCount} unsaved change${dirtyCount === 1 ? '' : 's'}` : 'All changes saved'}</p>
        <p className="text-xs text-[var(--color-gray-500)]">
          {lastUpdated.by && lastUpdated.at ? `Last updated by ${lastUpdated.by} at ${new Date(lastUpdated.at).toLocaleString('en-KE')}` : 'Using factory defaults'}
        </p>
      </div>

      {SECTIONS.map((section) => {
        const status = statuses[section.key];
        const sectionDirty = section.fields.some((field) => dirty.has(field));
        return (
          <Card key={section.key}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-gray-100)] pb-4">
              <div>
                <p className="eyebrow">{section.eyebrow}</p>
                <h2 className="mt-1 text-lg font-extrabold">{section.title}</h2>
                <p className="mt-1 text-sm text-[var(--color-gray-500)]">{section.description}</p>
              </div>
              <Badge tone={sectionDirty ? 'warning' : 'neutral'}>{sectionDirty ? 'Unsaved' : 'Up to date'}</Badge>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {section.fields.map((field) => {
                const key = String(field);
                const id = `setting-${key}`;
                if (BOOLEAN_FIELDS.has(key)) {
                  const on = values[field] === true;
                  const isDanger = key === 'maintenanceMode';
                  return (
                    <div key={key} className={`rounded-xl border p-4 sm:col-span-2 ${isDanger ? 'border-red-200 bg-red-50/60' : 'border-[var(--color-gray-200)] bg-[var(--color-gray-50)]'}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <label htmlFor={id} className={`text-sm font-bold ${isDanger ? 'text-red-700' : 'text-[var(--color-gray-900)]'}`}>{FIELD_LABELS[key] ?? key}</label>
                          {FIELD_HINTS[key] && <p className="mt-0.5 text-xs text-[var(--color-gray-500)]">{FIELD_HINTS[key]}</p>}
                          {isDanger && on && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-700"><AlertTriangle className="h-3.5 w-3.5" />Active: all non-admin users are blocked.</p>}
                        </div>
                        <button
                          id={id}
                          type="button"
                          role="switch"
                          aria-checked={on}
                          onClick={() => markChanged(field, !on)}
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${on ? (isDanger ? 'bg-red-600' : 'bg-[var(--color-primary)]') : 'bg-[var(--color-gray-300)]'}`}
                        >
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      {isDanger && (
                        <label htmlFor={`${id}-ack`} className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-semibold text-red-800">
                          <input id={`${id}-ack`} type="checkbox" checked={maintenanceAck} onChange={(event) => setMaintenanceAck(event.target.checked)} className="mt-0.5 h-4 w-4 accent-red-600" />
                          <span>I understand this blocks all non-admin users</span>
                        </label>
                      )}
                    </div>
                  );
                }
                if (NUMBER_FIELDS.has(key)) {
                  return (
                    <div key={key}>
                      <label htmlFor={id} className="mb-1.5 block text-sm font-bold">{FIELD_LABELS[key] ?? key}</label>
                      <Input id={id} type="number" inputMode="decimal" value={numOf(values, field)} onChange={(event) => markChanged(field, event.target.value === '' ? '' : Number(event.target.value))} />
                      {FIELD_HINTS[key] && <p className="mt-1.5 text-xs text-[var(--color-gray-500)]">{FIELD_HINTS[key]}</p>}
                    </div>
                  );
                }
                const multiline = key === 'bannerMessage' || key === 'tagline';
                return (
                  <div key={key} className={multiline ? 'sm:col-span-2' : undefined}>
                    <label htmlFor={id} className="mb-1.5 block text-sm font-bold">{FIELD_LABELS[key] ?? key}</label>
                    <Input id={id} type={key === 'supportEmail' ? 'email' : key === 'supportPhone' ? 'tel' : 'text'} value={textOf(values, field)} onChange={(event) => markChanged(field, event.target.value)} />
                    {FIELD_HINTS[key] && <p className="mt-1.5 text-xs text-[var(--color-gray-500)]">{FIELD_HINTS[key]}</p>}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-gray-100)] pt-4">
              <div>
                {status && (
                  <p role={status.tone === 'error' ? 'alert' : 'status'} className={`text-sm font-semibold ${status.tone === 'error' ? 'text-red-700' : 'text-green-700'}`}>
                    {status.message}
                  </p>
                )}
              </div>
              <Button type="button" variant="outline" disabled={saving !== null} onClick={() => void saveSection(section)}>
                <Save className="h-4 w-4" />
                {saving === section.key ? 'Saving…' : `Save ${section.title.toLowerCase()}`}
              </Button>
            </div>
          </Card>
        );
      })}

      <Card className="border-amber-200 bg-amber-50/60">
        <p className="flex items-center gap-2 text-sm font-extrabold text-amber-800"><ShieldAlert className="h-4 w-4" />Configuration changes are audited</p>
        <p className="mt-1 text-sm leading-6 text-amber-700">Every save records who changed what, when, and why. Fee and governance values apply to new records only.</p>
      </Card>
    </div>
  );
}
