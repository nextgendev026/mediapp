'use client';

import { Check, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/components/shared/AppProviders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Product } from '@/lib/data';

export function ProductDetailActions({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  function add() { addItem(product, quantity); setAdded(true); window.setTimeout(() => setAdded(false), 1800); }
  if (product.requiresPrescription) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Upload a valid prescription to add this medicine to your order.</div>;
  return <div className="space-y-3"><div className="flex items-center gap-3"><label htmlFor="product-quantity" className="text-sm font-bold">Quantity</label><div className="flex items-center rounded-lg border border-[var(--color-gray-300)]"><button type="button" className="flex h-11 w-11 items-center justify-center text-lg" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity">−</button><Input id="product-quantity" type="number" min={1} max={product.stock} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(product.stock, Number(event.target.value) || 1)))} className="h-11 w-14 border-0 p-0 text-center" /><button type="button" className="flex h-11 w-11 items-center justify-center text-lg" onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} aria-label="Increase quantity">+</button></div><span className="text-xs text-[var(--color-gray-500)]">{product.stock} available</span></div><Button size="lg" className="w-full" onClick={add}>{added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}{added ? 'Added to cart' : 'Add to cart'}</Button></div>;
}
