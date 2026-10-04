import { cn } from '@/lib/utils/cn';

export type StatusBadgeValue = 'pending' | 'confirmed' | 'dispatched' | 'in_transit' | 'delivered' | 'failed' | 'cancelled' | 'paid' | 'refunded' | 'active' | 'inactive';

const statusStyles: Record<StatusBadgeValue, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  confirmed: 'border-blue-200 bg-blue-50 text-blue-700',
  dispatched: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  in_transit: 'border-purple-200 bg-purple-50 text-purple-700',
  delivered: 'border-green-200 bg-green-50 text-green-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  cancelled: 'border-gray-200 bg-gray-50 text-gray-700',
  paid: 'border-green-200 bg-green-50 text-green-700',
  refunded: 'border-orange-200 bg-orange-50 text-orange-700',
  active: 'border-green-200 bg-green-50 text-green-700',
  inactive: 'border-gray-200 bg-gray-50 text-gray-700'
};

const statusLabels: Record<StatusBadgeValue, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  dispatched: 'Dispatched',
  in_transit: 'In transit',
  delivered: 'Delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
  paid: 'Paid',
  refunded: 'Refunded',
  active: 'Active',
  inactive: 'Inactive'
};

interface StatusBadgeProps {
  value: StatusBadgeValue;
  className?: string;
}

export function StatusBadge({ value, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        statusStyles[value],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {statusLabels[value]}
    </span>
  );
}
