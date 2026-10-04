import type { HTMLAttributes } from 'react';
import { cn } from './lib/cn';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'info';

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'border-[#E5E7EB] bg-[#F3F4F6] text-[#374151]',
  success: 'border-green-200 bg-green-50 text-green-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700'
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
