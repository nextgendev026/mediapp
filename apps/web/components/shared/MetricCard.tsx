import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: 'green' | 'blue' | 'orange' | 'purple';
}

export function MetricCard({ label, value, detail, icon: Icon, tone = 'green' }: MetricCardProps) {
  const tones = {
    green: 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]',
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    purple: 'bg-purple-50 text-purple-700'
  };
  return (
    <Card className="flex items-start justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-medium text-[var(--color-gray-500)]">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--color-gray-900)]">{value}</p>
        {detail && <p className="mt-1 text-xs font-semibold text-[var(--color-gray-500)]">{detail}</p>}
      </div>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
    </Card>
  );
}
