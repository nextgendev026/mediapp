import { Badge } from '@/components/ui/badge';
import type { OrderStatus } from '@/lib/data';

const labels: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  dispatched: 'Dispatched',
  in_transit: 'On the way',
  delivered: 'Delivered',
  failed: 'Failed'
};

const tones: Record<OrderStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  pending: 'warning',
  confirmed: 'info',
  dispatched: 'info',
  in_transit: 'info',
  delivered: 'success',
  failed: 'error'
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}
