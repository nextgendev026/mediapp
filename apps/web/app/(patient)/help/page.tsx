import { Clock3, Headphones, Mail, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';

const topics = [
  { title: 'Orders and delivery', body: 'Track a parcel, change a delivery address, or report a missing rider.', icon: Clock3 },
  { title: 'Payments and refunds', body: 'M-PESA prompts, partial refunds, and insurance reimbursement questions.', icon: ShieldCheck },
  { title: 'Prescriptions', body: 'Uploading scripts, refill limits, and pharmacist approval timelines.', icon: Mail },
  { title: 'Account and privacy', body: 'Consent withdrawal, data exports, and correcting your records.', icon: MessageCircle }
];

const contacts = [
  { label: 'Care support line', value: '+254 719 555 011', hint: '24 hours · English & Kiswahili', icon: Phone },
  { label: 'WhatsApp', value: '+254 719 555 011', hint: 'Send prescriptions and order photos', icon: MessageCircle },
  { label: 'Email', value: 'care@afyacommerce.co.ke', hint: 'We reply within one business day', icon: Mail },
  { label: 'Emergency', value: 'Call 999 or 112', hint: 'For life-threatening emergencies only', icon: Headphones }
];

export default function HelpPage() {
  return <div><PageHeader eyebrow="Support" title="How can we help?" description="Find answers about orders, payments, prescriptions, and your health data." /><div className="grid gap-4 sm:grid-cols-2">{topics.map((topic) => { const Icon = topic.icon; return <Card key={topic.title} className="p-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"><Icon className="h-5 w-5" /></span><h2 className="mt-4 font-extrabold">{topic.title}</h2><p className="mt-1 text-sm leading-6 text-[var(--color-gray-600)]">{topic.body}</p></Card>; })}</div><Card className="mt-6 p-0"><div className="border-b border-[var(--color-gray-100)] p-5"><h2 className="font-extrabold">Contact our team</h2><p className="mt-1 text-sm text-[var(--color-gray-500)]">Never share your PIN or OTP with anyone, including our staff.</p></div><ul className="divide-y divide-[var(--color-gray-100)]">{contacts.map((contact) => { const Icon = contact.icon; return <li key={contact.label} className="flex flex-wrap items-center gap-3 p-5"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-gray-100)] text-[var(--color-gray-600)]"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">{contact.label}</p><p className="font-bold">{contact.value}</p><p className="text-xs text-[var(--color-gray-500)]">{contact.hint}</p></div></li>; })}</ul></Card></div>;
}
