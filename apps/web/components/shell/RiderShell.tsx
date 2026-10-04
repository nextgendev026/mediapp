'use client';

import { Home, LifeBuoy, Truck } from 'lucide-react';
import { AppShell, type ShellNavItem } from '@/components/shared/AppShell';

const navItems: ShellNavItem[] = [
  { label: 'Dashboard', href: '/rider', icon: Home, exact: true },
  { label: 'Deliveries', href: '/rider/deliveries', icon: Truck },
  { label: 'Help', href: '/help', icon: LifeBuoy }
];

export function RiderShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell role="rider" navItems={navItems}>
      {children}
    </AppShell>
  );
}
