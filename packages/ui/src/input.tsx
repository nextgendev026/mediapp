import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from './lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, type = 'text', 'aria-invalid': ariaInvalid, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || ariaInvalid}
      className={cn(
        'flex min-h-[44px] w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-base text-[#111827] shadow-sm placeholder:text-[#6B7280] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DA84A] disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-red-500 focus-visible:outline-red-500',
        className
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';
