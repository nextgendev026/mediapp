'use client';

import { Activity, BarChart3, ClipboardCheck, Download, FileSearch, LayoutDashboard, Receipt, Settings2, ShieldCheck, Stethoscope, UsersRound } from 'lucide-react';
import { AppShell, type ShellNavItem } from '@/components/shared/AppShell';

const navItems: ShellNavItem[] = [
  { label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Visit workflow', href: '/admin/workflow', icon: Stethoscope },
  { label: 'User management', href: '/admin/users', icon: UsersRound },
  { label: 'Accounting', href: '/admin/accounting', icon: Receipt },
  { label: 'Audit log', href: '/admin/audit-log', icon: FileSearch },
  { label: 'Monitoring', href: '/admin/monitoring', icon: Activity },
  { label: 'Data export', href: '/admin/export', icon: Download },
  { label: 'Compliance', href: '/admin/compliance', icon: ClipboardCheck },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', icon: Settings2 }
];

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell role="admin" navItems={navItems}>{children}</AppShell>;
}
