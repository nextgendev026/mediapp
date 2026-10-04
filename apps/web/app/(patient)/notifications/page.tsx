'use client';

import { Banknote, Bell, CalendarClock, CheckCheck, Info, LoaderCircle, Pill, UserCog } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'appointment' | 'payment' | 'prescription' | 'account' | 'system';
  href?: string | undefined;
  read: boolean;
  createdAt: string;
}

const typeIcons = {
  appointment: CalendarClock,
  payment: Banknote,
  prescription: Pill,
  account: UserCog,
  system: Info
} as const;

function relativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(value).toLocaleDateString();
}

function isToday(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load notifications.');
      const payload = (await response.json()) as { notifications?: NotificationItem[]; unread?: number };
      setItems(Array.isArray(payload.notifications) ? payload.notifications : []);
      setUnread(typeof payload.unread === 'number' ? payload.unread : 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function markRead(ids?: string[]) {
    setBusy(true);
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify(ids && ids.length > 0 ? { ids } : {})
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const today = items.filter((item) => isToday(item.createdAt));
  const earlier = items.filter((item) => !isToday(item.createdAt));

  function renderRow(item: NotificationItem) {
    const Icon = typeIcons[item.type] ?? Info;
    const href = typeof item.href === 'string' && item.href.startsWith('/') ? (item.href as Route) : null;
    const body = (
      <div className={`min-w-0 flex-1 ${item.read ? '' : 'border-l-2 border-[var(--color-primary)] pl-3'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-extrabold">{item.title}</h2>
          {!item.read && <Badge tone="info">New</Badge>}
        </div>
        <p className="mt-1 text-sm leading-6 text-[var(--color-gray-600)]">{item.body}</p>
        <p className="mt-2 text-xs text-[var(--color-gray-500)]">{relativeTime(item.createdAt)}</p>
      </div>
    );
    return (
      <Card key={item.id} className="p-5">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-gray-100)] text-[var(--color-gray-600)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          {href ? (
            <Link href={href} className="flex min-w-0 flex-1 items-start gap-4 rounded-lg text-left hover:opacity-80">
              {body}
            </Link>
          ) : (
            body
          )}
          {!item.read && (
            <Button variant="ghost" size="sm" onClick={() => void markRead([item.id])} disabled={busy} aria-label={`Mark ${item.title} as read`}>
              <CheckCheck className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description={unread > 0 ? `${unread} unread update${unread === 1 ? '' : 's'}.` : items.length > 0 ? 'You are all caught up.' : 'Appointment, payment, and prescription updates appear here.'}
        action={
          <Button variant="outline" size="sm" onClick={() => void markRead()} disabled={busy || unread === 0}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Mark all read
          </Button>
        }
      />
      {loading && <p className="text-sm text-[var(--color-gray-500)]">Loading notifications…</p>}
      {!loading && error && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <Card className="flex flex-col items-center px-5 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]">
            <Bell className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-bold">No notifications yet</h2>
          <p className="mt-2 max-w-md text-sm text-[var(--color-gray-500)]">We will let you know about appointments, payments, and prescriptions.</p>
        </Card>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-6">
          {today.length > 0 && (
            <section aria-label="Today">
              <p className="eyebrow mb-3">Today</p>
              <div className="space-y-3">{today.map(renderRow)}</div>
            </section>
          )}
          {earlier.length > 0 && (
            <section aria-label="Earlier">
              <p className="eyebrow mb-3">Earlier</p>
              <div className="space-y-3">{earlier.map(renderRow)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
