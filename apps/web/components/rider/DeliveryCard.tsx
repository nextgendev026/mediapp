'use client';

import { MapPin, PackageCheck, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { OrderStatus } from '@/lib/data';
import { formatKES } from '@/lib/utils/format-currency';

export interface DeliveryView {
  id: string;
  number: string;
  customerName: string;
  customerPhone: string;
  address: string;
  itemCount: number;
  totalKes: number;
  status: OrderStatus;
  createdAt: string;
}

export function DeliveryCard({ delivery }: { delivery: DeliveryView }) {
  const isDone = delivery.status === 'delivered' || delivery.status === 'failed';
  return (
    <Card className="p-0">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            delivery.status === 'delivered' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
          }`}
        >
          {delivery.status === 'delivered' ? <PackageCheck className="h-6 w-6" /> : <Truck className="h-6 w-6" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-bold">{delivery.number}</p>
            <StatusBadge status={delivery.status} />
            <Badge tone="neutral">{delivery.itemCount} {delivery.itemCount === 1 ? 'item' : 'items'}</Badge>
          </div>
          <p className="mt-2 text-sm font-bold">{delivery.customerName}</p>
          <p className="mt-0.5 text-xs text-[var(--color-gray-500)]">{delivery.customerPhone}</p>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--color-gray-600)]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-secondary)]" />
            {delivery.address}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <div className="lg:text-right">
            <p className="text-sm font-extrabold">{formatKES(delivery.totalKes)}</p>
            <p className="mt-0.5 text-xs text-[var(--color-gray-500)]">{delivery.createdAt}</p>
          </div>
          <span title="Completion via dispatch" className="inline-flex">
            <Button size="sm" disabled>
              Mark delivered
            </Button>
          </span>
          <p className="text-[11px] font-semibold text-[var(--color-gray-500)]">
            {isDone ? 'Closed by dispatch team' : 'Completion via dispatch'}
          </p>
        </div>
      </div>
    </Card>
  );
}
