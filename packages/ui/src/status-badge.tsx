import type { ConsultationStatus, DeliveryStatus, PaymentStatus, PrescriptionStatus, TransactionStatus } from '@afyacommerce/types';
import { Badge } from './badge';
import type { BadgeVariant } from './badge';

export type StatusBadgeValue =
  | ConsultationStatus
  | DeliveryStatus
  | PaymentStatus
  | PrescriptionStatus
  | TransactionStatus;

const statusLabels: Record<StatusBadgeValue, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
  approved: 'Approved',
  dispensed: 'Dispensed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  confirmed: 'Confirmed',
  dispatched: 'Dispatched',
  in_transit: 'In transit',
  delivered: 'Delivered',
  initiated: 'Initiated',
  succeeded: 'Succeeded',
  reversed: 'Reversed',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  no_show: 'No show'
};

const statusVariants: Record<StatusBadgeValue, BadgeVariant> = {
  pending: 'warning',
  paid: 'success',
  failed: 'error',
  refunded: 'info',
  partially_refunded: 'info',
  approved: 'info',
  dispensed: 'success',
  cancelled: 'neutral',
  expired: 'error',
  confirmed: 'info',
  dispatched: 'info',
  in_transit: 'info',
  delivered: 'success',
  initiated: 'warning',
  succeeded: 'success',
  reversed: 'neutral',
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  no_show: 'error'
};

export interface StatusBadgeProps {
  status: StatusBadgeValue;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariants[status]} aria-label={`Status: ${statusLabels[status]}`}>
      <span aria-hidden="true">●</span>
      <span>{label ?? statusLabels[status]}</span>
    </Badge>
  );
}
