'use client';

import { Check, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/components/shared/AppProviders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Product } from '@/lib/data';
import { formatKES } from '@/lib/utils/format-currency';

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const categoryLabel = product.category === 'prescription' ? 'Prescription' : product.category === 'otc' ? 'Over the counter' : product.category === 'device' ? 'Device' : 'Supplement';

  function addToCart() {
    addItem(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return <Card className="group flex h-full flex-col overflow-hidden p-0 transition hover:-translate-y-1 hover:shadow-lg"><Link href={`/pharmacy/${product.id}`} className={`relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br ${product.accent}`} aria-label={`View ${product.name}`}><div className="absolute -right-5 -top-8 h-28 w-28 rounded-full bg-white/60" /><div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white/75 shadow-sm"><span className="text-3xl" aria-hidden="true">{product.category === 'device' ? '🩺' : product.category === 'supplement' ? '☀️' : '💊'}</span></div>{product.requiresPrescription && <Badge tone="warning" className="absolute left-3 top-3">Rx required</Badge>}<span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[var(--color-gray-600)]">{product.county}</span></Link><div className="flex flex-1 flex-col p-4"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-gray-500)]">{categoryLabel}</span><span className="text-[11px] font-semibold text-[var(--color-gray-500)]">{product.stock < 10 ? 'Low stock' : 'In stock'}</span></div><Link href={`/pharmacy/${product.id}`}><h3 className="mt-2 line-clamp-1 text-base font-extrabold hover:text-[var(--color-primary-dark)]">{product.name}</h3></Link><p className="mt-1 text-xs text-[var(--color-gray-500)]">{product.genericName}</p><p className="mt-1 text-xs italic text-[var(--color-gray-500)]">{product.swahiliName}</p><div className="mt-auto flex items-end justify-between gap-2 pt-5"><p className="text-lg font-extrabold text-[var(--color-gray-900)]">{formatKES(product.price)}</p>{product.requiresPrescription ? <Link href="/prescriptions/upload" className="inline-flex min-h-9 items-center rounded-md border border-[var(--color-primary)] px-2 text-xs font-bold text-[var(--color-primary-dark)]">Upload Rx</Link> : <Button size="sm" onClick={addToCart}>{added ? <Check className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}{added ? 'Added' : 'Add'}</Button>}</div></div></Card>;
}
