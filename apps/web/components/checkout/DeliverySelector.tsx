'use client';

import { Check, Clock3, MapPin, Store, Truck } from 'lucide-react';
import { formatKES } from '@/lib/utils/format-currency';

export type DeliveryMethod = 'boda' | 'pickup' | 'clinic';

interface DeliverySelectorProps {
  value: DeliveryMethod;
  onChange: (value: DeliveryMethod) => void;
  county: string;
}

const methods = [
  { key: 'boda' as const, title: 'Boda-boda delivery', detail: 'Same-day, discreet doorstep delivery', eta: '2–4 hours', fee: 200, icon: Truck, tone: 'green' },
  { key: 'pickup' as const, title: 'Pickup point', detail: 'Collect from a verified nearby point', eta: 'Within 24 hours', fee: 50, icon: Store, tone: 'blue' },
  { key: 'clinic' as const, title: 'Clinic collection', detail: 'Collect at your preferred clinic', eta: 'Next appointment', fee: 0, icon: MapPin, tone: 'orange' }
];

export function DeliverySelector({ value, onChange, county }: DeliverySelectorProps) {
  return <div><div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold">How should we deliver?</p><span className="text-xs text-[var(--color-gray-500)]">County: {county}</span></div><div className="space-y-3">{methods.map((method) => { const Icon = method.icon; const selected = value === method.key; return <button type="button" key={method.key} onClick={() => onChange(method.key)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${selected ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-gray-200)] bg-white hover:border-[#b9ebca]'}`} aria-pressed={selected}><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${method.tone === 'green' ? 'bg-[#d8f5e1] text-[var(--color-primary-dark)]' : method.tone === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{method.title}</span><span className="mt-1 block text-xs text-[var(--color-gray-500)]">{method.detail}</span><span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-gray-600)]"><Clock3 className="h-3.5 w-3.5" />{method.eta}</span></span><span className="text-right"><span className="block text-sm font-extrabold">{method.fee ? formatKES(method.fee) : 'Free'}</span>{selected && <Check className="ml-auto mt-2 h-4 w-4 text-[var(--color-primary-dark)]" />}</span></button>; })}</div></div>;
}
