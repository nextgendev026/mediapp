'use client';

import { Check, Info, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ConsentGateProps {
  onConsent: (consent: boolean) => void;
  defaultGranted?: boolean;
}

export function ConsentGate({ onConsent, defaultGranted = false }: ConsentGateProps) {
  const [granted, setGranted] = useState(defaultGranted);
  const [telehealth, setTelehealth] = useState(true);

  return (
    <section className="surface space-y-4 border-[#b9ebca] bg-[#f7fff9] p-4" aria-labelledby="consent-heading">
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
        <div>
          <h2 id="consent-heading" className="font-bold text-[var(--color-gray-900)]">Your privacy matters</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--color-gray-600)]">Choose how AfyaCommerce may use your health information. You can change these choices any time.</p>
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-gray-200)] bg-white p-3">
        <input type="checkbox" checked={granted} onChange={(event) => { setGranted(event.target.checked); onConsent(event.target.checked); }} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" />
        <span className="text-sm"><strong>Health data processing</strong><span className="mt-0.5 block text-[var(--color-gray-500)]">Allow processing of my health data for treatment, payment, and safe delivery.</span></span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-gray-200)] bg-white p-3">
        <input type="checkbox" checked={telehealth} onChange={(event) => setTelehealth(event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" />
        <span className="text-sm"><strong>Telehealth</strong><span className="mt-0.5 block text-[var(--color-gray-500)]">Allow secure video, voice, and chat consultations.</span></span>
      </label>
      <div className="flex items-start gap-2 text-xs text-[var(--color-gray-500)]"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Read our <button type="button" className="font-semibold text-[var(--color-secondary)] underline">privacy notice</button> before submitting.</div>
      {granted && <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary-dark)]"><Check className="h-4 w-4" aria-hidden="true" />Consent recorded for this session</div>}
    </section>
  );
}
