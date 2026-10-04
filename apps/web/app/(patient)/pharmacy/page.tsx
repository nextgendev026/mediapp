'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, FileUp, Pill, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { DataState } from '@/components/shared/DataState';
import { ProductGrid } from '@/components/pharmacy/ProductGrid';
import { TrustBadges } from '@/components/shared/TrustBadges';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { products } from '@/lib/data';

export default function PharmacyPage() {
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
        eyebrow="Licensed pharmacy"
        title="Pharmacy, on your terms"
        description="Find trusted medicines, devices, and everyday health essentials with transparent pricing and discreet delivery."
        action={
          <Link href="/prescriptions/upload">
            <Button variant="outline">
              <FileUp className="mr-2 h-4 w-4" />
              Upload a prescription
            </Button>
          </Link>
        }
      />
      <DataState
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && products.length === 0}
        onRetry={loadData}
        loadingLabel="Loading pharmacy catalog"
        emptyStateTitle="No products available"
        emptyStateDescription="Our catalog is being updated. Please check back soon."
        emptyStateIcon={Pill}
      >
        <div className="mb-7 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-3 rounded-xl border border-[#b9ebca] bg-[var(--color-primary-light)] p-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary-dark)]" />
            <div>
              <p className="text-sm font-extrabold text-[var(--color-primary-dark)]">Search in English or Kiswahili</p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-gray-600)]">
                Try &ldquo;paracetamol&rdquo;, &ldquo;chumvi&rdquo;, or a generic name. Our catalog is matched to licensed pharmacy stock.
              </p>
            </div>
          </div>
          <Link href="/cart" className="hidden items-center gap-2 text-sm font-bold text-[var(--color-primary-dark)] lg:inline-flex">
            View cart
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ProductGrid products={products} />
        <div className="mt-8 flex flex-col gap-3 rounded-xl border border-[var(--color-gray-200)] bg-white p-4 text-xs text-[var(--color-gray-500)] sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" />
            All stock is supplied by licensed pharmacies.
          </span>
          <TrustBadges ppbLicence="PPB/2026/AFY-1048" kmhfrId="KMHFR-KE-8821" pharmacistRegNo="PPB-P-77842" isShaEmpanelled />
        </div>
      </DataState>
    </div>
  );
}
