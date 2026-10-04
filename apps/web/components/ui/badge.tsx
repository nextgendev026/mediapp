import { cn } from '@/lib/utils/cn';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        tone === 'success' && 'border-green-200 bg-green-50 text-green-700',
        tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700',
        tone === 'error' && 'border-red-200 bg-red-50 text-red-700',
        tone === 'info' && 'border-blue-200 bg-blue-50 text-blue-700',
        tone === 'primary' && 'border-[#b9ebca] bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]',
        tone === 'neutral' && 'border-[var(--color-gray-200)] bg-[var(--color-gray-100)] text-[var(--color-gray-700)]',
        className
      )}
      {...props}
    />
  );
}
