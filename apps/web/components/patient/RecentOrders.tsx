import Link from 'next/link';
import { ArrowRight, Package, Truck } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card } from '@/components/ui/card';
import { orders } from '@/lib/data';
import { formatKES } from '@/lib/utils/format-currency';

export function RecentOrders() {
  return <Card className="p-0"><div className="flex items-center justify-between border-b border-[var(--color-gray-100)] px-5 py-4"><div><h2 className="font-extrabold">Recent orders</h2><p className="mt-1 text-xs text-[var(--color-gray-500)]">Your latest pharmacy activity</p></div><Link href="/orders" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[var(--color-primary-dark)]">View all<ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="divide-y divide-[var(--color-gray-100)]">{orders.slice(0, 2).map((order) => <Link href={`/orders/${order.id}/track`} key={order.id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-[var(--color-gray-50)]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]">{order.status === 'delivered' ? <Package className="h-5 w-5" /> : <Truck className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold">{order.number}</p><StatusBadge status={order.status} /></div><p className="mt-1 truncate text-xs text-[var(--color-gray-500)]">{order.items} items · {order.pharmacy}</p></div><div className="text-right"><p className="text-sm font-bold">{formatKES(order.total)}</p><p className="mt-1 text-xs text-[var(--color-gray-500)]">{order.eta}</p></div></Link>)}</div></Card>;
}
