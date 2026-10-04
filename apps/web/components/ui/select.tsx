import { cn } from '@/lib/utils/cn';

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'min-h-11 w-full rounded-lg border border-[var(--color-gray-300)] bg-white px-3.5 py-2.5 text-base outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[#b9ebca]',
        className
      )}
      {...props}
    />
  );
}
