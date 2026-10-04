'use client';

import { AlertTriangle, BarChart3, ClipboardCheck, FileText, LayoutDashboard, PackageSearch, Truck } from 'lucide-react';
import { AppShell, type ShellNavItem } from '@/components/shared/AppShell';

const navItems: ShellNavItem[] = [
  { label: 'Overview', href: '/pharmacist/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Prescription queue', href: '/pharmacist/prescriptions', icon: ClipboardCheck },
  { label: 'Inventory', href: '/pharmacist/inventory', icon: PackageSearch },
  { label: 'Fulfillment', href: '/pharmacist/orders', icon: Truck },
  { label: 'Reports', href: '/pharmacist/reports', icon: BarChart3 }
];

export function PharmacistShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell role="pharmacist" navItems={navItems}>{children}</AppShell>;
}
