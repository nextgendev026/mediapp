'use client';

import { ChevronDown, LogOut, Menu, Search, X } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BrandMark } from '@/components/shared/BrandMark';
import { LanguageToggle } from '@/components/shared/LanguageToggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import type { UserRole } from '@/lib/data';

export interface ShellNavItem {
  label: string;
  href: Route;
  icon: React.ElementType;
  exact?: boolean;
}

const roleLabels: Record<UserRole, string> = {
  patient: 'Patient portal',
  provider: 'Provider workspace',
  pharmacist: 'Pharmacy operations',
  admin: 'Admin console',
  rider: 'Rider console'
};

async function signOut() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' }, body: '{}' });
  } finally {
    window.location.href = '/login';
  }
}

export function AppShell({ children, role, navItems }: { children: React.ReactNode; role: UserRole; navItems: ShellNavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  function isActive(item: ShellNavItem) {
    return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return (
    <div className="min-h-screen bg-[var(--color-gray-50)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-gray-200)] bg-white/95 backdrop-blur">
        <div className="container-shell flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close navigation' : 'Open navigation'}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <BrandMark />
            <span className="hidden border-l border-[var(--color-gray-200)] pl-3 text-xs font-semibold text-[var(--color-gray-500)] md:inline">{roleLabels[role]}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative hidden xl:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gray-500)]" aria-hidden="true" />
              <span className="sr-only">Search</span>
              <input className="h-10 w-64 rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] pl-9 pr-3 text-sm outline-none focus:border-[var(--color-primary)]" placeholder="Search your care" />
            </label>
            <span className="hidden md:block">
              <LanguageToggle />
            </span>
            <NotificationBell />
            <div className="relative">
              <button type="button" onClick={() => setProfileOpen((value) => !value)} className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-[var(--color-gray-100)]" aria-expanded={profileOpen}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary-dark)]">JW</span>
                <span className="hidden text-left lg:block"><span className="block text-xs font-bold">James W.</span><span className="block text-[11px] text-[var(--color-gray-500)]">{roleLabels[role]}</span></span>
                <ChevronDown className="h-4 w-4 text-[var(--color-gray-500)]" />
              </button>
              {profileOpen && <div className="absolute right-0 top-12 w-48 rounded-xl border border-[var(--color-gray-200)] bg-white p-2 shadow-lg"><Link href="/profile" className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-[var(--color-gray-100)]">My profile</Link><Link href="/profile/consent" className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-[var(--color-gray-100)]">Consent settings</Link><button type="button" onClick={signOut} className="flex min-h-11 w-full items-center rounded-lg px-3 text-sm text-red-700 hover:bg-red-50"><LogOut className="mr-2 h-4 w-4" />Sign out</button></div>}
            </div>
          </div>
        </div>
      </header>
      <div className="container-shell flex gap-6 py-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:py-7 lg:pb-5">
        <aside className={`${open ? 'fixed inset-x-0 top-16 z-20 block max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-[var(--color-gray-200)] bg-white p-4 shadow-lg' : 'hidden'} w-full shrink-0 lg:static lg:block lg:w-64 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}>
          <div className="mb-5 hidden rounded-xl bg-[var(--color-primary-light)] p-4 lg:block">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-primary-dark)]">Good morning</p>
            <p className="mt-1 text-sm font-semibold text-[var(--color-gray-700)]">Your care, in one place.</p>
          </div>
          <nav className="space-y-1" aria-label={`${roleLabels[role]} navigation`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${isActive(item) ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]' : 'text-[var(--color-gray-600)] hover:bg-white hover:text-[var(--color-gray-900)]'}`} aria-current={isActive(item) ? 'page' : undefined}><Icon className="h-[18px] w-[18px]" />{item.label}</Link>;
            })}
          </nav>
          <div className="mt-7 hidden rounded-xl border border-[var(--color-gray-200)] bg-white p-4 lg:block">
            <p className="text-xs font-bold text-[var(--color-gray-900)]">Need help?</p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-gray-500)]">Our care team is available 24/7.</p>
            <Link href="/help" className="mt-3 inline-block text-xs font-bold text-[var(--color-secondary)]">Visit help centre →</Link>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-gray-200)] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="flex">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-center transition ${
                  active ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]' : 'text-[var(--color-gray-600)]'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="w-full truncate text-[10px] font-bold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
