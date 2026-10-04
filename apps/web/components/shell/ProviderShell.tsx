'use client';

import { CalendarDays, ClipboardList, FilePlus2, LayoutDashboard, MessageCircle, UsersRound } from 'lucide-react';
import { AppShell, type ShellNavItem } from '@/components/shared/AppShell';

const navItems: ShellNavItem[] = [
  { label: 'Overview', href: '/provider/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Appointments', href: '/provider/appointments', icon: CalendarDays },
  { label: 'Patient queue', href: '/provider/patients', icon: UsersRound },
  { label: 'New prescription', href: '/provider/prescriptions/new', icon: FilePlus2 },
  { label: 'Consultation rooms', href: '/provider/consultations', icon: MessageCircle }
];

export function ProviderShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell role="provider" navItems={navItems}>{children}</AppShell>;
}
