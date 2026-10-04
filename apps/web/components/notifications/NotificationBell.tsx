'use client';

import { Bell, Banknote, CalendarClock, CheckCheck, Info, LoaderCircle, Pill, UserCog } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = (await response.json()) as { notifications?: NotificationItem[]; unread?: number };
      setItems(Array.isArray(payload.notifications) ? payload.notifications.slice(0, 8) : []);
      setUnread(typeof payload.unread === 'number' ? payload.unread : 0);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!open) return undefined;
    function onDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function markAllRead() {
    setBusy(true);
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: '{}'
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-gray-600)] hover:bg-[var(--color-gray-100)]"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-xl border border-[var(--color-gray-200)] bg-white shadow-lifted">
          <div className="flex items-center justify-between border-b border-[var(--color-gray-100)] px-4 py-3">
            <p className="text-sm font-extrabold">Notifications</p>
            <p className="text-[11px] font-semibold text-[var(--color-gray-500)]">{unread} unread</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-[var(--color-gray-500)]">You are all caught up.</p>}
            {items.map((item) => {
              const Icon = typeIcons[item.type] ?? Info;
              return (
                <div key={item.id} className={`flex gap-3 border-b border-[var(--color-gray-100)] px-4 py-3 last:border-0 ${item.read ? '' : 'bg-[var(--color-primary-light)]'}`}>
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-primary-dark)]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold">{item.title}</p>
                    <p className="line-clamp-2 text-xs leading-5 text-[var(--color-gray-600)]">{item.body}</p>
                    <p className="mt-1 text-[10px] font-semibold text-[var(--color-gray-500)]">{relativeTime(item.createdAt)}</p>
                  </div>
                  {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" aria-label="Unread" />}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[var(--color-gray-100)] px-3 py-2">
            <Link href="/notifications" onClick={() => setOpen(false)} className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-bold text-[var(--color-primary-dark)] hover:bg-[var(--color-gray-100)]">
              View all
            </Link>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={busy || unread === 0}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[var(--color-gray-600)] hover:bg-[var(--color-gray-100)] disabled:pointer-events-none disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
