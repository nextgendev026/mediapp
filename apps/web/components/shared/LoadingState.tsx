import { cn } from '@/lib/utils/cn';

interface LoadingStateProps {
  className?: string | undefined;
  label?: string | undefined;
}

export function LoadingState({ className, label = 'Loading' }: LoadingStateProps) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-12', className)} role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-gray-300)] border-t-[var(--color-primary)]" aria-hidden="true" />
      <span className="text-sm font-medium text-[var(--color-gray-500)]">{label}...</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-[var(--color-gray-200)]', className)} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="surface space-y-4 p-5" aria-hidden="true">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-8 w-24" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
