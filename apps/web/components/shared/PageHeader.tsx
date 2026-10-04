import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, backHref, action }: { eyebrow?: string; title: string; description?: string; backHref?: Route; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>{backHref && <Link href={backHref} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-gray-500)] hover:text-[var(--color-primary-dark)]"><ArrowLeft className="h-3.5 w-3.5" />Back</Link>}{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-gray-600)]">{description}</p>}</div>{action}</div>;
}
