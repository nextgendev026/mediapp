'use client';

import { ArrowLeft, MapPin, PackageSearch, Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DeliveryTracker } from '@/components/orders/DeliveryTracker';
import { ProofOfDelivery } from '@/components/orders/ProofOfDelivery';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { orders, type Order } from '@/lib/data';
import { formatKES } from '@/lib/utils/format-currency';

export default function TrackOrderPage({ params }: { params: { orderId: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let found: Order | undefined;
    try {
      const stored = window.localStorage.getItem('afya-orders');
      if (stored) {
        const list = JSON.parse(stored) as Order[];
        found = list.find((item) => item.id === params.orderId);
      }
    } catch {
      found = undefined;
    }
    if (!found) found = orders.find((item) => item.id === params.orderId);
    setOrder(found ?? null);
    setLoading(false);
  }, [params.orderId]);

  if (loading) {
    return <div aria-busy="true" aria-live="polite"><div className="h-4 w-24 animate-pulse rounded bg-[var(--color-gray-200)]" /><div className="mt-6 h-9 w-64 animate-pulse rounded bg-[var(--color-gray-200)]" /><div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"><div className="h-80 animate-pulse rounded-xl bg-[var(--color-gray-200)]" /><div className="h-80 animate-pulse rounded-xl bg-[var(--color-gray-200)]" /></div><span className="sr-only">Loading order</span></div>;
  }

  if (!order) {
    return <div><Link href="/orders" className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-gray-500)] hover:text-[var(--color-primary-dark)]"><ArrowLeft className="h-3.5 w-3.5" />Back to orders</Link><Card className="p-10 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-gray-100)] text-[var(--color-gray-500)]"><PackageSearch className="h-7 w-7" /></span><h1 className="mt-5 text-2xl font-extrabold">We could not find that order</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-gray-500)]">Order <span className="font-mono font-bold">{params.orderId}</span> is not linked to this device. Orders placed on another device or browser are not visible here.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/orders"><Button>View my orders</Button></Link><Link href="/help"><Button variant="outline">Contact support</Button></Link></div></Card></div>;
  }

  return <div><Link href="/orders" className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-gray-500)] hover:text-[var(--color-primary-dark)]"><ArrowLeft className="h-3.5 w-3.5" />Back to orders</Link><div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Order tracking</p><h1 className="mt-1 font-mono text-2xl font-extrabold tracking-tight sm:text-3xl">{order.number}</h1><p className="mt-2 text-sm text-[var(--color-gray-500)]">Placed {order.date} · {order.items} items · {formatKES(order.total)}</p></div><StatusBadge status={order.status} /></div><div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"><DeliveryTracker order={order} /><div className="space-y-6"><Card><h2 className="font-extrabold">Delivery details</h2><div className="mt-4 space-y-3 text-sm"><p className="flex items-center gap-2 text-[var(--color-gray-600)]"><MapPin className="h-4 w-4 text-[var(--color-accent)]" />Near Equity Bank, Kasarani</p><p className="flex items-center gap-2 text-[var(--color-gray-600)]"><Phone className="h-4 w-4 text-[var(--color-primary)]" />+254 712 345 678</p><p className="flex items-center gap-2 text-[var(--color-gray-600)]"><ShieldCheck className="h-4 w-4 text-[var(--color-secondary)]" />Discreet package required</p></div><Link href="/help" className="mt-5 inline-flex text-xs font-bold text-[var(--color-secondary)]">Contact support →</Link></Card><ProofOfDelivery /></div></div></div>;
}
