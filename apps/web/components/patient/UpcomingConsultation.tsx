import { ArrowRight, CalendarDays, Clock3, Video } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { upcomingConsultation } from '@/lib/data';

export function UpcomingConsultation() {
  return <Card className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-[var(--color-gray-100)] px-5 py-4"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-extrabold">Upcoming consultation</h2></div><Badge tone="primary">Confirmed</Badge></div><div className="p-5"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#b9ebca] text-xl font-extrabold text-[var(--color-primary-dark)]">{upcomingConsultation.avatar}</span><div className="min-w-0 flex-1"><p className="text-lg font-extrabold">{upcomingConsultation.provider}</p><p className="mt-1 text-sm text-[var(--color-gray-500)]">{upcomingConsultation.specialty}</p><div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[var(--color-gray-600)]"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[var(--color-primary)]" />{upcomingConsultation.date}</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-[var(--color-primary)]" />{upcomingConsultation.time}</span><span className="inline-flex items-center gap-1.5"><Video className="h-3.5 w-3.5 text-[var(--color-secondary)]" />{upcomingConsultation.mode}</span></div></div><Link href={`/consultations/${upcomingConsultation.id}`}><Button size="sm" variant="outline">Join room<ArrowRight className="ml-2 h-3.5 w-3.5" /></Button></Link></div></div></Card>;
}
