'use client';

import { ArrowRight, CalendarClock, FileText, Pill } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatKES } from '@/lib/utils/format-currency';

export function PrescriptionRefillCard() {
  const [requested, setRequested] = useState(false);
  return <Card className="h-full"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-700"><Pill className="h-5 w-5" aria-hidden="true" /></span><Badge tone={requested ? 'success' : 'warning'}>{requested ? 'Requested' : 'Refill available'}</Badge></div><h2 className="mt-5 text-lg font-extrabold">Metformin 500mg</h2><p className="mt-1 text-sm text-[var(--color-gray-500)]">30 tablets · {formatKES(290)}</p><div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[var(--color-gray-500)]"><CalendarClock className="h-4 w-4 text-[var(--color-accent)]" />0 refills remaining</div><div className="mt-5 flex gap-2"><Button size="sm" onClick={() => setRequested(true)} disabled={requested}>{requested ? 'Request sent' : 'Request refill'}</Button><Link href="/prescriptions" className="flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-bold text-[var(--color-secondary)] hover:underline">Details<ArrowRight className="h-3.5 w-3.5" /></Link></div></Card>;
}

export function PrescriptionEmptyCard() {
  return <Card className="flex h-full flex-col items-center justify-center text-center"><FileText className="h-8 w-8 text-[var(--color-gray-300)]" /><p className="mt-3 text-sm font-bold">No prescriptions yet</p><Link href="/prescriptions/upload" className="mt-2 text-xs font-bold text-[var(--color-primary-dark)]">Upload one →</Link></Card>;
}
