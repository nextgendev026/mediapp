'use client';

import Link from 'next/link';
import { ArrowRight, Check, UserRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { ConsentGate } from '@/components/shared/ConsentGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isValidKenyanPhone, normalizeKenyanPhone } from '@/lib/utils/validate-phone';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/auth/register-status', { cache: 'no-store' });
        const data = (await res.json()) as { registrationOpen?: boolean };
        if (active && typeof data.registrationOpen === 'boolean') setRegistrationOpen(data.registrationOpen);
      } catch {
        return;
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!registrationOpen) {
      setError('Registration is currently closed. Please check back later or call support on 0800 722 000.');
      return;
    }
    if (name.trim().length < 2) { setError('Enter your full name.'); return; }
    if (!isValidKenyanPhone(phone)) { setError('Enter a valid Kenyan mobile number.'); return; }
    if (!consent) { setError('Please accept health data processing to create your account.'); return; }
    const normalized = normalizeKenyanPhone(phone);
    setLoading(true);
    try {
      window.localStorage.setItem('afya-login-phone', normalized);
      window.localStorage.setItem('afya-register-name', name.trim());
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { error: authError } = await supabase.auth.signInWithOtp({
          phone: normalized,
          options: {
            shouldCreateUser: true,
            data: { full_name: name.trim(), role: 'patient', phi_consent: 'true' }
          }
        });
        if (authError) throw authError;
      }
      setComplete(true);
    } catch {
      setError('We could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (complete) {
    return <div className="w-full max-w-md text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"><Check className="h-7 w-7" /></span><p className="eyebrow mt-6">Almost there</p><h1 className="mt-3 text-3xl font-extrabold">Check your phone</h1><p className="mt-3 leading-6 text-[var(--color-gray-600)]">We sent a 6-digit verification code to <strong>{phone}</strong>. It expires in 10 minutes.</p><Link href="/verify-otp" className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-6 text-base font-semibold text-white hover:bg-[var(--color-primary-dark)]">Verify mobile number<ArrowRight className="h-4 w-4" /></Link></div>;
  }

  return (
    <div className="w-full max-w-xl">
      <div className="mb-8"><p className="eyebrow">Create your account</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight">Start your care journey</h1><p className="mt-3 text-base leading-6 text-[var(--color-gray-600)]">Join a trusted care and pharmacy platform built around your health.</p></div>
      {!registrationOpen && (
        <div role="status" className="mb-5 rounded-xl border border-orange-300 bg-orange-50 p-4">
          <p className="text-sm font-extrabold text-orange-800">Registration is temporarily closed</p>
          <p className="mt-1 text-sm leading-6 text-orange-700">New sign-ups are paused right now. Please check back soon, or call support on 0800 722 000.</p>
        </div>
      )}
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label htmlFor="register-name" className="mb-2 block text-sm font-bold">Full name</label><div className="relative"><UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gray-500)]" /><Input id="register-name" autoComplete="name" placeholder="e.g. James Wanjiku" value={name} onChange={(event) => setName(event.target.value)} className="pl-10" /></div></div>
          <div><label htmlFor="register-phone" className="mb-2 block text-sm font-bold">Mobile number</label><Input id="register-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXX" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
        </div>
        <ConsentGate onConsent={setConsent} />
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading || !registrationOpen}>{loading ? 'Creating account…' : 'Create my account'}<ArrowRight className="h-4 w-4" /></Button>
      </form>
      <p className="mt-7 text-center text-sm text-[var(--color-gray-500)]">Already have an account? <Link href="/login" className="font-bold text-[var(--color-primary-dark)] hover:underline">Sign in</Link></p>
    </div>
  );
}
