import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from './lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[#1DA84A] text-white hover:bg-[#168A3C] focus-visible:outline-[#1DA84A]',
  secondary: 'bg-[#0066CC] text-white hover:bg-[#0052a3] focus-visible:outline-[#0066CC]',
  outline: 'border border-[#1DA84A] bg-white text-[#168A3C] hover:bg-[#E8F7ED] focus-visible:outline-[#1DA84A]',
  ghost: 'bg-transparent text-[#374151] hover:bg-[#F3F4F6] focus-visible:outline-[#1DA84A]',
  destructive: 'bg-[#EF4444] text-white hover:bg-[#dc2626] focus-visible:outline-[#EF4444]'
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  default: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-11 w-11 p-0'
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'default', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
});

Button.displayName = 'Button';
