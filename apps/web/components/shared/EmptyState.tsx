import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title: string;
  description?: string | undefined;
  actionLabel?: string | undefined;
  actionHref?: Route | undefined;
  action?: { label: string; onClick: () => void } | undefined;
  icon?: React.ElementType;
}

export function EmptyState({ title, description, actionLabel, actionHref, action, icon: Icon = ArrowRight }: EmptyStateProps) {
  return (
    <div className="surface flex flex-col items-center justify-center px-5 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"><Icon className="h-6 w-6" aria-hidden="true" /></span>
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--color-gray-500)]">{description}</p>
      {action && <Button className="mt-5" variant="outline" size="sm" onClick={action.onClick}>{action.label}</Button>}
      {actionLabel && actionHref && <Button className="mt-5" variant="outline" size="sm"><Link href={actionHref}>{actionLabel}<ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden="true" /></Link></Button>}
    </div>
  );
}
