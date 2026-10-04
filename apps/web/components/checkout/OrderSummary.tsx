'use client';

import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { useCart } from '@/components/shared/AppProviders';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatKES } from '@/lib/utils/format-currency';

export function OrderSummary({ deliveryFee = 0, actionHref = '/checkout/delivery', actionLabel = 'Continue to delivery', compact = false }: { deliveryFee?: number | undefined; actionHref?: Route | undefined; actionLabel?: string | undefined; compact?: boolean | undefined }) {
  const { items, subtotal, itemCount } = useCart();
  const total = subtotal + deliveryFee;
  return <Card className={compact ? 'p-4' : ''}><div className="flex items-center justify-between"><h2 className="font-extrabold">Order summary</h2><span className="text-xs font-semibold text-[var(--color-gray-500)]">{itemCount} items</span></div><div className="mt-4 space-y-3">{items.length ? items.map((item) => <div key={item.product.id} className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-lg">💊</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.product.name}</p><p className="text-xs text-[var(--color-gray-500)]">{item.quantity} × {formatKES(item.product.price)}</p></div><p className="text-sm font-bold">{formatKES(item.product.price * item.quantity)}</p></div>) : <div className="rounded-lg bg-[var(--color-gray-50)] p-5 text-center text-sm text-[var(--color-gray-500)]"><ShoppingBag className="mx-auto h-6 w-6 text-[var(--color-gray-300)]" /><p className="mt-2">Your cart is empty.</p><Link href="/pharmacy" className="mt-2 inline-block font-bold text-[var(--color-primary-dark)]">Browse pharmacy</Link></div>}</div><div className="mt-5 space-y-2 border-t border-[var(--color-gray-100)] pt-4 text-sm"><div className="flex justify-between text-[var(--color-gray-600)]"><span>Subtotal</span><span>{formatKES(subtotal)}</span></div><div className="flex justify-between text-[var(--color-gray-600)]"><span>Delivery</span><span>{deliveryFee ? formatKES(deliveryFee) : 'Calculated next'}</span></div><div className="flex justify-between pt-2 text-base font-extrabold"><span>Total</span><span className="text-[var(--color-primary-dark)]">{formatKES(total)}</span></div></div>{actionHref && <Link href={actionHref} className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-bold text-white hover:bg-[var(--color-primary-dark)]">{actionLabel}<ArrowRight className="h-4 w-4" /></Link>}{actionHref === '/checkout/delivery' && <Link href="/cart" className="mt-3 flex min-h-11 items-center justify-center gap-2 text-xs font-bold text-[var(--color-gray-600)] hover:text-[var(--color-primary-dark)]"><Trash2 className="h-3.5 w-3.5" />Edit cart</Link>}</Card>;
}
