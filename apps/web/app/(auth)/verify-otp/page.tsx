'use client';

import { ArrowRight, KeyRound, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function VerifyOtpPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setPhone(window.localStorage.getItem('afya-login-phone') ?? '');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from your phone.'); return; }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !phone) throw new Error('not-configured');
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
      if (verifyError) throw verifyError;
      setSuccess(true);
      window.setTimeout(() => { window.location.href = '/dashboard'; }, 900);
    } catch {
      setError('That code is invalid or expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !phone) throw new Error('not-configured');
      const { error: resendError } = await supabase.auth.resend({ type: 'sms', phone });
      if (resendError) throw resendError;
    } catch {
      setError('We could not resend the code. Try again shortly.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8"><p className="eyebrow">Secure verification</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight">Enter your one-time code</h1><p className="mt-3 leading-6 text-[var(--color-gray-600)]">We sent a 6-digit code to {phone ? <strong>{phone}</strong> : 'your phone'}.</p></div>
      <form onSubmit={submit} className="space-y-5">
        <div><label htmlFor="otp-code" className="mb-2 block text-sm font-bold">Verification code</label><div className="relative"><KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gray-500)]" /><Input id="otp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="pl-10 text-center text-2xl font-bold tracking-[0.45em]" /></div></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        {success && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">Verified. Taking you to your dashboard…</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading || success}>{loading ? 'Verifying…' : 'Verify and continue'}<ArrowRight className="h-4 w-4" /></Button>
      </form>
      <button type="button" onClick={resend} disabled={resending} className="mx-auto mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-secondary)] hover:underline disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />{resending ? 'Resending…' : 'Didn’t get a code? Resend'}</button>
      <p className="mt-6 text-center text-sm text-[var(--color-gray-500)]">Changed your number? <Link href="/login" className="font-bold text-[var(--color-primary-dark)]">Start again</Link></p>
    </div>
  );
}
