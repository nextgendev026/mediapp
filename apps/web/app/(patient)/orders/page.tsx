'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, CalendarDays, PackageCheck, PackageSearch, Search, Truck } from 'lucide-react';
import Link from 'next/link';
import { DataState } from '@/components/shared/DataState';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { orders } from '@/lib/data';
import { formatKES } from '@/lib/utils/format-currency';

export default function OrdersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setIsLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const cleanup = loadData();
    return cleanup;
  }, [loadData]);

  return (
    <div>
      <PageHeader
        eyebrow="Orders & delivery"
        title="My orders"
        description="Track pharmacy orders, see delivery progress, and access proof of delivery."
        action={
          <Link href="/pharmacy">
            <span className="inline-flex min-h-11 items-center rounded-lg border border-[var(--color-primary)] px-4 text-sm font-bold text-[var(--color-primary-dark)]">
              Order medicines
              <ArrowRight className="ml-2 h-4 w-4" />
            </span>
          </Link>
        }
      />
      <DataState
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && orders.length === 0}
        onRetry={loadData}
        loadingLabel="Loading your orders"
        emptyStateTitle="No orders yet"
        emptyStateDescription="When you place an order, it will appear here with live tracking."
        emptyStateIcon={PackageSearch}
      >
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gray-500)]" />
            <input
              className="min-h-11 w-full rounded-lg border border-[var(--color-gray-300)] bg-white pl-10 pr-3 text-sm outline-none focus:border-[var(--color-primary)]"
              placeholder="Search order number"
              aria-label="Search order number"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className="min-h-11 rounded-lg bg-[var(--color-primary-light)] px-4 text-xs font-bold text-[var(--color-primary-dark)]">
              All orders
            </button>
            <button type="button" className="min-h-11 rounded-lg border border-[var(--color-gray-200)] bg-white px-4 text-xs font-bold text-[var(--color-gray-600)]">
              In progress
            </button>
            <button type="button" className="min-h-11 rounded-lg border border-[var(--color-gray-200)] bg-white px-4 text-xs font-bold text-[var(--color-gray-600)]">
              Delivered
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="p-0">
              <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    order.status === 'delivered' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {order.status === 'delivered' ? <PackageCheck className="h-6 w-6" /> : <Truck className="h-6 w-6" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-bold">{order.number}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-gray-500)]">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {order.date}
                    </span>
                    <span>{order.items} items</span>
                    <span>{order.pharmacy}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 lg:justify-end">
                  <div className="text-left lg:text-right">
                    <p className="font-extrabold">{formatKES(order.total)}</p>
                    <p className="mt-1 text-xs text-[var(--color-gray-500)]">{order.eta}</p>
                  </div>
                  <Link href={`/orders/${order.id}/track`}>
                    <span className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[var(--color-primary)] px-3 text-xs font-bold text-[var(--color-primary-dark)]">
                      {order.status === 'delivered' ? 'View details' : 'Track order'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                </div>
              </div>
              {order.status !== 'delivered' && (
                <div className="border-t border-[var(--color-gray-100)] bg-[var(--color-gray-50)] px-5 py-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-gray-600)]">
                    <span>Delivery progress</span>
                    <span>{order.progress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${order.progress}%` }} />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
        <Card className="mt-6 flex items-start gap-3 border-blue-100 bg-blue-50">
          <Badge tone="info">SMS fallback</Badge>
          <p className="text-sm leading-6 text-blue-800">
            No smartphone? We send order and delivery updates by SMS so you can always follow your care.
          </p>
        </Card>
      </DataState>
    </div>
  );
}
