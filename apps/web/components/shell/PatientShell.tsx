'use client';

import { Bell, ClipboardList, FileText, Home, MessageCircle, Pill, ShoppingBag, Truck, UserRound } from 'lucide-react';
import { AppShell, type ShellNavItem } from '@/components/shared/AppShell';

const navItems: ShellNavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: Home, exact: true },
  { label: 'Consultations', href: '/consultations', icon: MessageCircle },
  { label: 'Prescriptions', href: '/prescriptions', icon: FileText },
  { label: 'Medical records', href: '/records', icon: ClipboardList },
  { label: 'Pharmacy', href: '/pharmacy', icon: Pill },
  { label: 'My orders', href: '/orders', icon: Truck },
  { label: 'Profile & privacy', href: '/profile', icon: UserRound }
];

export function PatientShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell role="patient" navItems={navItems}>{children}</AppShell>;
}
