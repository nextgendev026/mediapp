import { Ambulance, ClipboardList, FileText, MessageCircle, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';

interface QuickAction {
  label: string;
  detail: string;
  href: Route;
  icon: typeof Stethoscope;
  tone: string;
}

const actions: QuickAction[] = [
  { label: 'Book a consultation', detail: 'See a clinician', href: '/consultations/book', icon: Stethoscope, tone: 'bg-blue-50 text-blue-700' },
  { label: 'My prescriptions', detail: 'View and refill', href: '/prescriptions', icon: FileText, tone: 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]' },
  { label: 'Medical records', detail: 'Your health timeline', href: '/records', icon: ClipboardList, tone: 'bg-teal-50 text-teal-700' },
  { label: 'Track an order', detail: 'Live delivery', href: '/orders', icon: MessageCircle, tone: 'bg-orange-50 text-orange-700' },
  { label: 'Emergency help', detail: 'Find care now', href: '/help', icon: Ambulance, tone: 'bg-red-50 text-red-700' }
];

export function QuickActions() {
  return <section aria-labelledby="quick-actions-heading"><div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Shortcuts</p><h2 id="quick-actions-heading" className="mt-1 text-xl font-extrabold">What would you like to do?</h2></div><span className="text-xs font-semibold text-[var(--color-gray-500)]">Available 24/7</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{actions.map((action) => { const Icon = action.icon; return <Link key={action.href} href={action.href} className="surface group flex min-h-28 flex-col justify-between p-4 transition hover:-translate-y-0.5 hover:border-[#b9ebca] hover:shadow-md"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span><span><span className="mt-4 block text-sm font-extrabold leading-5">{action.label}</span><span className="mt-1 block text-xs text-[var(--color-gray-500)]">{action.detail}</span></span></Link>; })}</div></section>;
}
