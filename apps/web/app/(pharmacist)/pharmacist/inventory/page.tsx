'use client';

import { AlertTriangle, PackagePlus, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { products, type ProductCategory } from '@/lib/data';
import { formatKES } from '@/lib/utils/format-currency';

const LOW_STOCK_THRESHOLD = 20;

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  prescription: 'Prescription',
  otc: 'Over the counter',
  device: 'Devices',
  supplement: 'Supplements'
};

const FILTERS: { key: 'all' | ProductCategory | 'low'; label: string }[] = [
  { key: 'all', label: 'All stock' },
  { key: 'prescription', label: 'Prescription' },
  { key: 'otc', label: 'OTC' },
  { key: 'device', label: 'Devices' },
  { key: 'supplement', label: 'Supplements' },
  { key: 'low', label: 'Low stock' }
];

export default function InventoryPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | ProductCategory | 'low'>('all');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const haystack = `${product.name} ${product.genericName} ${product.pharmacy} ${product.ppbNumber}`.toLowerCase();
      const matchesQuery = !needle || haystack.includes(needle);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'low' ? product.stock <= LOW_STOCK_THRESHOLD : product.category === filter);
      return matchesQuery && matchesFilter;
    });
  }, [filter, query]);

  const lowCount = products.filter((product) => product.stock <= LOW_STOCK_THRESHOLD).length;

  return (
    <div>
      <PageHeader
        eyebrow="Stock control"
        title="Inventory"
        description="Live catalog stock, expiry, and PPB registration for licensed dispensing."
        action={
          <Badge tone={lowCount > 0 ? 'warning' : 'success'}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {lowCount} low-stock {lowCount === 1 ? 'item' : 'items'}
          </Badge>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gray-500)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-[var(--color-gray-300)] bg-white pl-10 pr-3 text-sm outline-none focus:border-[var(--color-primary)]"
            placeholder="Search product, generic name, or PPB number"
            aria-label="Search inventory"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`min-h-11 rounded-lg px-3 text-xs font-bold ${
                filter === item.key
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]'
                  : 'border border-[var(--color-gray-200)] bg-white text-[var(--color-gray-600)]'
              }`}
              aria-pressed={filter === item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center px-5 py-12 text-center">
          <PackagePlus className="h-8 w-8 text-[var(--color-gray-300)]" />
          <p className="mt-3 font-extrabold">No products match that search</p>
          <p className="mt-1 text-sm text-[var(--color-gray-500)]">Try a generic name or clear the category filter.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:hidden">
            {filtered.map((product) => {
              const low = product.stock <= LOW_STOCK_THRESHOLD;
              return (
                <Card key={product.id} className={low ? 'border-orange-300 bg-orange-50/60 p-4' : 'p-4'}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{product.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-gray-500)]">{product.genericName}</p>
                    </div>
                    <Badge tone={low ? 'warning' : 'success'}>{low ? 'Low stock' : 'In stock'}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-gray-600)]">
                    <span className="rounded-lg bg-[var(--color-gray-100)] px-2 py-1 font-semibold">{CATEGORY_LABELS[product.category]}</span>
                    <span className="rounded-lg bg-[var(--color-gray-100)] px-2 py-1 font-semibold">{product.stock} units</span>
                    <span className="rounded-lg bg-[var(--color-gray-100)] px-2 py-1 font-semibold">Exp {product.expiry}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-extrabold">{formatKES(product.price)}</span>
                    {product.requiresPrescription && <Badge tone="info">Rx required</Badge>}
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-gray-500)]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                    {product.ppbNumber} · {product.pharmacy}
                  </p>
                </Card>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <Card className="p-0">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-[var(--color-gray-200)] bg-[var(--color-gray-50)] text-xs uppercase tracking-wide text-[var(--color-gray-500)]">
                  <tr>
                    <th className="px-5 py-4 font-bold">Product</th>
                    <th className="px-4 py-4 font-bold">Category</th>
                    <th className="px-4 py-4 font-bold">Price</th>
                    <th className="px-4 py-4 font-bold">Stock</th>
                    <th className="px-4 py-4 font-bold">Expiry</th>
                    <th className="px-4 py-4 font-bold">PPB / license</th>
                    <th className="px-5 py-4 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-gray-100)]">
                  {filtered.map((product) => {
                    const low = product.stock <= LOW_STOCK_THRESHOLD;
                    return (
                      <tr key={product.id} className={low ? 'bg-orange-50' : 'hover:bg-[var(--color-gray-50)]'}>
                        <td className="px-5 py-4">
                          <span className="block font-bold">{product.name}</span>
                          <span className="mt-1 block text-xs text-[var(--color-gray-500)]">{product.genericName} · {product.pharmacy}</span>
                        </td>
                        <td className="px-4 py-4 text-xs text-[var(--color-gray-600)]">{CATEGORY_LABELS[product.category]}</td>
                        <td className="px-4 py-4 font-semibold">{formatKES(product.price)}</td>
                        <td className={`px-4 py-4 font-bold ${low ? 'text-orange-700' : ''}`}>{product.stock}</td>
                        <td className="px-4 py-4 text-xs text-[var(--color-gray-600)]">{product.expiry}</td>
                        <td className="px-4 py-4">
                          <span className="block font-mono text-xs">{product.ppbNumber}</span>
                          <span className="mt-1 block text-xs text-[var(--color-gray-500)]">Registered with PPB</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={low ? 'warning' : 'success'}>{low ? 'Low stock' : 'In stock'}</Badge>
                            {product.requiresPrescription && <Badge tone="info">Rx required</Badge>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}

      <Card className="mt-6 flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" />
        <p className="text-sm leading-6 text-[var(--color-gray-600)]">
          Every catalog item carries its PPB registration and batch expiry. Low-stock items are highlighted so reorders
          happen before the shelf runs dry.
        </p>
      </Card>
    </div>
  );
}
