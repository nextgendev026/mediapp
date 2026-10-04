'use client';

import { CalendarDays, Pill, Receipt, Share2, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';

export type RecordType = 'appointment' | 'encounter' | 'prescription' | 'referral' | 'invoice';

export type RecordHref = `/invoice/${string}` | `/prescriptions/${string}` | `/consultations/${string}`;

export interface RecordEntry {
  id: string;
  type: RecordType;
  at: string;
  title: string;
  detail: string;
  status: string;
  href: RecordHref | null;
}

type FilterKey = 'all' | 'consultations' | 'prescriptions' | 'referrals' | 'bills';

interface FilterDef {
  key: FilterKey;
  label: string;
  types: RecordType[];
}

const FILTER_MAP: Record<FilterKey, FilterDef> = {
  all: { key: 'all', label: 'All', types: ['appointment', 'encounter', 'prescription', 'referral', 'invoice'] },
  consultations: { key: 'consultations', label: 'Consultations', types: ['appointment', 'encounter'] },
  prescriptions: { key: 'prescriptions', label: 'Prescriptions', types: ['prescription'] },
  referrals: { key: 'referrals', label: 'Referrals', types: ['referral'] },
  bills: { key: 'bills', label: 'Bills', types: ['invoice'] }
};

const FILTERS = Object.values(FILTER_MAP);

const TYPE_META: Record<RecordType, { label: string; icon: React.ElementType; tone: string; dot: string }> = {
  appointment: { label: 'Appointment', icon: CalendarDays, tone: 'bg-blue-50 text-blue-700', dot: 'bg-blue-100 text-blue-700' },
  encounter: { label: 'Encounter', icon: Stethoscope, tone: 'bg-green-50 text-green-700', dot: 'bg-green-100 text-green-700' },
  prescription: {
    label: 'Prescription',
    icon: Pill,
    tone: 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]',
    dot: 'bg-[#b9ebca] text-[var(--color-primary-dark)]'
  },
  referral: { label: 'Referral', icon: Share2, tone: 'bg-orange-50 text-orange-700', dot: 'bg-orange-100 text-orange-700' },
  invoice: { label: 'Bill', icon: Receipt, tone: 'bg-gray-100 text-gray-600', dot: 'bg-gray-200 text-gray-600' }
};

const SUCCESS_STATUSES = ['completed', 'approved', 'dispensed', 'accepted', 'closed', 'paid'];
const ERROR_STATUSES = ['rejected', 'cancelled', 'no_show', 'void', 'failed'];

function statusTone(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  if (SUCCESS_STATUSES.includes(status)) return 'success';
  if (ERROR_STATUSES.includes(status)) return 'error';
  if (['pending_approval', 'partially_paid', 'open', 'issued', 'draft', 'urgent'].includes(status)) return 'warning';
  if (['booked', 'in_transit', 'dispatched'].includes(status)) return 'info';
  return 'neutral';
}

function statusLabel(status: string): string {
  const text = status.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDay(at: string): string {
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) return at.slice(0, 10);
  return parsed.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface MonthGroup {
  key: string;
  label: string;
  entries: RecordEntry[];
}

export function RecordTimeline({ items }: { items: RecordEntry[] }) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const active = FILTER_MAP[filter];

  const visible = useMemo(() => items.filter((item) => active.types.includes(item.type)), [items, active]);

  const groups = useMemo<MonthGroup[]>(() => {
    const months: MonthGroup[] = [];
    for (const entry of visible) {
      const parsed = new Date(entry.at);
      const valid = !Number.isNaN(parsed.getTime());
      const key = valid
        ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
        : entry.at.slice(0, 7);
      const label = valid
        ? parsed.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
        : entry.at.slice(0, 7);
      const last = months[months.length - 1];
      if (last && last.key === key) {
        last.entries.push(entry);
      } else {
        months.push({ key, label, entries: [entry] });
      }
    }
    return months;
  }, [visible]);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter medical records">
        {FILTERS.map((chip) => {
          const selected = chip.key === filter;
          return (
            <button
              type="button"
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              aria-pressed={selected}
              className={`min-h-11 rounded-full border px-4 text-xs font-bold transition ${
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]'
                  : 'border-[var(--color-gray-200)] bg-white text-[var(--color-gray-600)] hover:border-[#b9ebca]'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--color-gray-300)] bg-white p-6 text-center">
          <p className="text-sm font-bold">Nothing here yet</p>
          <p className="mt-1 text-xs text-[var(--color-gray-500)]">Records for this filter will appear as your care continues.</p>
        </div>
      )}

      <div className="mt-6 space-y-8">
        {groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[var(--color-gray-500)]">{group.label}</h2>
            <ol className="mt-4 space-y-4">
              {group.entries.map((entry, index) => {
                const meta = TYPE_META[entry.type];
                const Icon = meta.icon;
                const isLast = index === group.entries.length - 1;
                return (
                  <li key={`${entry.type}-${entry.id}`} className="relative pl-9">
                    <span
                      className={`absolute left-0 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full ${meta.dot}`}
                      aria-hidden="true"
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    {!isLast && (
                      <span className="absolute left-[10px] top-6 -bottom-4 w-0.5 bg-[var(--color-gray-200)]" aria-hidden="true" />
                    )}
                    <div className="rounded-xl border border-[var(--color-gray-200)] bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">
                            {meta.label} · {formatDay(entry.at)}
                          </p>
                          {entry.href ? (
                            <Link href={entry.href} className="mt-1 block text-sm font-extrabold text-[var(--color-gray-900)] hover:text-[var(--color-primary-dark)] hover:underline">
                              {entry.title}
                            </Link>
                          ) : (
                            <p className="mt-1 text-sm font-extrabold text-[var(--color-gray-900)]">{entry.title}</p>
                          )}
                          {entry.detail && <p className="mt-1 text-sm leading-6 text-[var(--color-gray-600)]">{entry.detail}</p>}
                        </div>
                        <Badge tone={statusTone(entry.status)}>{statusLabel(entry.status)}</Badge>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
