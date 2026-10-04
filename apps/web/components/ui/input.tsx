import { cn } from '@/lib/utils/cn';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'min-h-11 w-full rounded-lg border border-[var(--color-gray-300)] bg-white px-3.5 py-2.5 text-base text-[var(--color-gray-900)] outline-none transition placeholder:text-[var(--color-gray-500)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[#b9ebca] disabled:cursor-not-allowed disabled:bg-[var(--color-gray-100)]',
        className
      )}
      {...props}
    />
  );
}
