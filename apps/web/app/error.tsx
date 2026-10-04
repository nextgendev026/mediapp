'use client';

import { useEffect } from 'react';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { void reset; }, [reset]);
  return <div className="flex min-h-screen items-center justify-center bg-[var(--color-gray-50)] px-5 text-center"><div className="max-w-md"><p className="eyebrow">Something went wrong</p><h1 className="mt-3 text-2xl font-extrabold">We could not load this page</h1><p className="mt-3 text-sm text-[var(--color-gray-600)]">Please try again. If the problem continues, contact support on 0800 722 000.</p><button type="button" onClick={() => reset()} className="mt-6 min-h-11 rounded-lg bg-[var(--color-primary)] px-5 text-sm font-bold text-white">Try again</button></div></div>;
}
