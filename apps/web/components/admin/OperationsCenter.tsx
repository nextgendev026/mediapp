'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, MessageCircle, RefreshCw, ShieldAlert, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { AppSettings } from '@/lib/server/settings';

type ToggleKey = 'bookingEnabled' | 'chatEnabled' | 'mpesaEnabled' | 'maintenanceMode';

interface ToggleDef {
  key: ToggleKey;
  label: string;
  hint: string;
  icon: typeof CalendarCheck;
  danger?: boolean;
}

const TOGGLES: ToggleDef[] = [
  { key: 'bookingEnabled', label: 'Booking', hint: 'New consultation bookings', icon: CalendarCheck },
  { key: 'chatEnabled', label: 'Chat', hint: 'Patient and clinician messaging', icon: MessageCircle },
  { key: 'mpesaEnabled', label: 'M-PESA', hint: 'STK push checkout', icon: Smartphone },
  { key: 'maintenanceMode', label: 'Maintenance mode', hint: 'Blocks all non-admin users', icon: ShieldAlert, danger: true }
];

interface HealthPayload {
  status?: string;
  checks?: { db?: string; settings?: string };
}

export function OperationsCenter() {
  const [settings, setSettings] = useState<Partial<AppSettings> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<ToggleKey | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [health, setHealth] = useState<{ tone: 'green' | 'amber' | 'red'; text: string }>({ tone: 'amber', text: 'Checking…' });

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings', { headers: { 'X-Afya-Client': 'web' }, cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load settings.');
      const data = (await res.json()) as { settings?: AppSettings };
      if (data.settings) setSettings({ ...data.settings });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load settings.');
    } finally {
      setLoaded(true);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data = (await res.json()) as HealthPayload;
      if (res.ok && data.status === 'ok') setHealth({ tone: 'green', text: 'All systems operational' });
      else if (data.status === 'degraded') setHealth({ tone: 'amber', text: 'Degraded service' });
      else setHealth({ tone: 'red', text: 'Health check failed' });
    } catch {
      setHealth({ tone: 'red', text: 'Unreachable' });
    }
  }, []);

  useEffect(() => {
    void loadSettings();
    void loadHealth();
    const timer = setInterval(() => void loadHealth(), 60_000);
    return () => clearInterval(timer);
  }, [loadHealth, loadSettings]);

  async function toggle(def: ToggleDef) {
    if (!settings) return;
    const previous = settings[def.key];
    const next = previous !== true;
    if (def.danger && next) {
      const confirmed = window.confirm('Enable maintenance mode? Every non-admin user will be redirected to the sign-in page until you turn it off.');
      if (!confirmed) return;
    }
    setError('');
    setNote('');
    setPending(def.key);
    setSettings((prev) => ({ ...prev, [def.key]: next }) as Partial<AppSettings>);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify({ [def.key]: next })
      });
      const data = (await res.json()) as { settings?: AppSettings; error?: string };
      if (!res.ok || !data.settings) throw new Error(data.error || 'Could not update setting.');
      setSettings({ ...data.settings });
      setNote(`${def.label} turned ${next ? 'on' : 'off'} · recorded as settings_update in the audit log.`);
    } catch (err) {
      setSettings((prev) => ({ ...prev, [def.key]: previous }) as Partial<AppSettings>);
      setError(err instanceof Error ? err.message : 'Could not update setting.');
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-gray-100)] pb-4">
        <div>
          <p className="eyebrow">Live switches</p>
          <h2 className="mt-1 text-lg font-extrabold">Operations controls</h2>
          <p className="mt-1 text-sm text-[var(--color-gray-500)]">Flip platform capabilities without a deploy. Changes apply immediately.</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${health.tone === 'green' ? 'border-green-200 bg-green-50 text-green-700' : health.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <span className={`h-2 w-2 rounded-full ${health.tone === 'green' ? 'bg-green-500' : health.tone === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} aria-hidden="true" />
          {health.text}
          <button type="button" onClick={() => void loadHealth()} className="text-[var(--color-gray-400)] hover:text-[var(--color-gray-700)]" aria-label="Refresh system health">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TOGGLES.map((def) => {
          const on = settings?.[def.key] === true;
          const Icon = def.icon;
          return (
            <div key={def.key} className={`rounded-xl border p-4 ${def.danger && on ? 'border-red-300 bg-red-50' : 'border-[var(--color-gray-200)] bg-[var(--color-gray-50)]'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${def.danger && on ? 'bg-red-100 text-red-700' : 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]'}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <Badge tone={!loaded ? 'neutral' : def.danger && on ? 'error' : on ? 'success' : 'neutral'}>
                  {!loaded ? '…' : on ? 'On' : 'Off'}
                </Badge>
              </div>
              <p className="mt-3 text-sm font-extrabold">{def.label}</p>
              <p className="mt-0.5 text-xs text-[var(--color-gray-500)]">{def.hint}</p>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Toggle ${def.label}`}
                disabled={!loaded || pending !== null}
                onClick={() => void toggle(def)}
                className={`mt-3 relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-60 ${on ? (def.danger ? 'bg-red-600' : 'bg-[var(--color-primary)]') : 'bg-[var(--color-gray-300)]'}`}
              >
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 min-h-[20px]">
        {error && <p role="alert" className="text-sm font-semibold text-red-700">{error} Reverted.</p>}
        {!error && note && <p role="status" className="text-sm font-semibold text-[var(--color-gray-600)]">{note}</p>}
        {!error && !note && loaded && <p className="text-xs text-[var(--color-gray-500)]">Toggles are optimistic: state reverts automatically if the server rejects the change.</p>}
      </div>
    </Card>
  );
}
