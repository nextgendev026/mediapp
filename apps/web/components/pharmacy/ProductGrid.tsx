'use client';

import { Filter, PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { KENYA_COUNTIES } from '@/lib/utils/counties';
import { ProductCard } from '@/components/pharmacy/ProductCard';
import type { Product } from '@/lib/data';

export function ProductGrid({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [county, setCounty] = useState('all');
  const [prescriptionOnly, setPrescriptionOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => products.filter((product) => {
    const haystack = `${product.name} ${product.genericName} ${product.swahiliName} ${product.description}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (category === 'all' || product.category === category) && (county === 'all' || product.county === county) && (!prescriptionOnly || product.requiresPrescription);
  }), [category, county, prescriptionOnly, products, query]);

  return <div className="grid gap-6 lg:grid-cols-[230px_1fr]"><aside className={`${showFilters ? 'block' : 'hidden'} h-fit rounded-xl border border-[var(--color-gray-200)] bg-white p-4 lg:block`}><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-extrabold"><SlidersHorizontal className="h-4 w-4" />Filters</h2><button type="button" className="lg:hidden" onClick={() => setShowFilters(false)} aria-label="Close filters"><X className="h-5 w-5" /></button></div><div className="mt-5 space-y-5"><div><label htmlFor="catalog-category" className="mb-2 block text-xs font-bold text-[var(--color-gray-600)]">Category</label><Select id="catalog-category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option><option value="prescription">Prescription</option><option value="otc">Over the counter</option><option value="device">Devices</option><option value="supplement">Supplements</option></Select></div><div><label htmlFor="catalog-county" className="mb-2 block text-xs font-bold text-[var(--color-gray-600)]">Available in county</label><Select id="catalog-county" value={county} onChange={(event) => setCounty(event.target.value)}><option value="all">All counties</option>{KENYA_COUNTIES.map((item) => <option key={item} value={item}>{item}</option>)}</Select></div><label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" checked={prescriptionOnly} onChange={(event) => setPrescriptionOnly(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" /><span>Prescription required</span></label><button type="button" onClick={() => { setQuery(''); setCategory('all'); setCounty('all'); setPrescriptionOnly(false); }} className="text-xs font-bold text-[var(--color-secondary)] hover:underline">Clear all filters</button></div></aside><div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gray-500)]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search medicines, generic names, or Kiswahili names" className="pl-10" aria-label="Search pharmacy catalog" /></div><Button variant="outline" className="lg:hidden" onClick={() => setShowFilters(true)}><Filter className="h-4 w-4" />Filters</Button></div><div className="mt-4 flex items-center justify-between"><p className="text-sm text-[var(--color-gray-500)]"><strong className="text-[var(--color-gray-900)]">{filtered.length}</strong> products found</p><span className="text-xs font-semibold text-[var(--color-gray-500)]">Prices include licensed pharmacy supply</span></div>{filtered.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="surface mt-4 flex flex-col items-center px-5 py-16 text-center"><PackageSearch className="h-10 w-10 text-[var(--color-gray-300)]" /><h2 className="mt-4 font-extrabold">No medicines match that search</h2><p className="mt-2 text-sm text-[var(--color-gray-500)]">Try a generic name, clear a filter, or search in Kiswahili.</p></div>}</div></div>;
}
