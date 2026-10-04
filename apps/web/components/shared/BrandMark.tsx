import { HeartPulse, Plus } from 'lucide-react';
import Link from 'next/link';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="AfyaCommerce home">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-sm transition group-hover:bg-[var(--color-primary-dark)]">
        <HeartPulse className="h-5 w-5" strokeWidth={2.5} />
      </span>
      {!compact && <span className="text-lg font-extrabold tracking-tight text-[var(--color-gray-900)]">Afya<span className="text-[var(--color-primary)]">Commerce</span></span>}
    </Link>
  );
}

export function BrandButton() {
  return (
    <Link href="/pharmacy" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-dark)]">
      <Plus className="h-4 w-4" />
      Order medicines
    </Link>
  );
}
