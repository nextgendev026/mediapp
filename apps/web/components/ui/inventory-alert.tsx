import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type InventoryAlertType = 'low-stock' | 'near-expiry' | 'expired';

export interface InventoryAlertProps {
  type: InventoryAlertType;
  children: ReactNode;
  className?: string;
}

const alertClasses: Record<InventoryAlertType, string> = {
  'low-stock': 'border-amber-200 bg-amber-50 text-amber-800',
  'near-expiry': 'border-orange-200 bg-orange-50 text-orange-800',
  expired: 'border-red-200 bg-red-50 text-red-800'
};

export function InventoryAlert({ type, children, className }: InventoryAlertProps) {
  return (
    <div
      role="status"
      className={cn('rounded-lg border p-3 text-sm font-medium', alertClasses[type], className)}
    >
      {children}
    </div>
  );
}
