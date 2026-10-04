import { cn } from '@/lib/utils/cn';

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-28 w-full rounded-lg border border-[var(--color-gray-300)] bg-white px-3.5 py-2.5 text-base outline-none transition placeholder:text-[var(--color-gray-500)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[#b9ebca]',
        className
      )}
      {...props}
    />
  );
}
