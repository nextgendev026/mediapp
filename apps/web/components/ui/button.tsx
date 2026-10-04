import { cn } from '@/lib/utils/cn';

export function Button({
  className,
  variant = 'primary',
  size = 'default',
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'mpesa';
  size?: 'sm' | 'default' | 'lg' | 'icon';
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]',
        variant === 'mpesa' && 'bg-[#1da84a] text-white hover:bg-[#168a3c]',
        variant === 'secondary' && 'bg-[var(--color-secondary)] text-white hover:bg-[#0055aa]',
        variant === 'outline' && 'border border-[var(--color-primary)] bg-white text-[var(--color-primary-dark)] hover:bg-[var(--color-primary-light)]',
        variant === 'ghost' && 'text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)]',
        variant === 'destructive' && 'bg-[var(--color-error)] text-white hover:bg-[#dc2626]',
        size === 'sm' && 'min-h-9 rounded-md px-3 py-1.5 text-xs',
        size === 'lg' && 'min-h-12 px-6 text-base',
        size === 'icon' && 'h-11 w-11 p-0',
        className
      )}
      {...props}
    />
  );
}
