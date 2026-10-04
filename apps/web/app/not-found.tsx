import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';
import { BrandMark } from '@/components/shared/BrandMark';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-gray-50)] px-5 text-center"><BrandMark /><span className="mt-10 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"><SearchX className="h-8 w-8" /></span><p className="eyebrow mt-6">Page not found</p><h1 className="mt-2 text-3xl font-extrabold">We could not find that page</h1><p className="mt-3 max-w-md text-sm leading-6 text-[var(--color-gray-600)]">The link may be out of date. Return to your care dashboard or browse trusted medicines.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back home</Button></Link><Link href="/dashboard"><Button>Go to dashboard</Button></Link></div></div>;
}
