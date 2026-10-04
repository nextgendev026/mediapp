'use client';

import Link from 'next/link';
import { ArrowRight, KeyRound, LockKeyhole, Phone, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isValidKenyanPhone, normalizeKenyanPhone } from '@/lib/utils/validate-phone';

const ROLE_HOME: Record<string, string> = {
  patient: '/dashboard',
  provider: '/provider/dashboard',
  pharmacist: '/pharmacist/dashboard',
  admin: '/admin/dashboard',
  rider: '/rider'
};

export default function LoginPage({ searchParams }: { searchParams?: { maintenance?: string | string[] } }) {
  const maintenance = Boolean(searchParams?.maintenance);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!isValidKenyanPhone(phone)) {
      setError('Enter a valid Kenyan mobile number.');
      return;
    }
    const normalized = normalizeKenyanPhone(phone);
    setLoading(true);
    try {
      window.localStorage.setItem('afya-login-phone', normalized);
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error('not-configured');
      const { error: authError } = await supabase.auth.signInWithOtp({ phone: normalized, options: { shouldCreateUser: true } });
      if (authError) throw authError;
      setNotice('Your one-time code is on its way. It expires in 10 minutes.');
    } catch {
      setError('We could not send the code. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPassError('');
    setPassLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = (await res.json()) as { error?: string; role?: string };
      if (!res.ok) throw new Error(data.error || 'Sign-in failed.');
      window.location.href = ROLE_HOME[data.role ?? 'patient'] ?? '/dashboard';
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Sign-in failed.');
      setPassLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      {maintenance && (
        <div role="status" className="mb-6 rounded-xl border border-orange-300 bg-orange-50 p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold text-orange-800"><ShieldAlert className="h-4 w-4" aria-hidden="true" />Scheduled maintenance in progress</p>
          <p className="mt-1.5 text-sm leading-6 text-orange-700">Non-admin accounts are temporarily paused while we carry out platform maintenance. Patient support is available on 0800 722 000.</p>
        </div>
      )}
      <div className="mb-8">
        <p className="eyebrow">Welcome back</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Sign in to AfyaCommerce</h1>
        <p className="mt-3 text-base leading-6 text-[var(--color-gray-600)]">Use your Kenyan mobile number and we will send a secure one-time code.</p>
      </div>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="login-phone" className="mb-2 block text-sm font-bold">Mobile number</label>
          <div className="relative"><Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gray-500)]" aria-hidden="true" /><Input id="login-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXX" value={phone} onChange={(event) => setPhone(event.target.value)} className="pl-10" aria-describedby="login-phone-help" /></div>
          <p id="login-phone-help" className="mt-2 text-xs text-[var(--color-gray-500)]">We will never share your number without your consent.</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">{notice}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? 'Sending code…' : 'Continue with phone'}<ArrowRight className="h-4 w-4" /></Button>
      </form>
      <div className="my-7 flex items-center gap-3 text-xs text-[var(--color-gray-400)]"><span className="h-px flex-1 bg-[var(--color-gray-200)]" />Staff &amp; member sign-in<span className="h-px flex-1 bg-[var(--color-gray-200)]" /></div>
      <form onSubmit={submitPassword} className="space-y-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-4" noValidate>
        <p className="flex items-center gap-2 text-sm font-bold text-[var(--color-gray-900)]"><KeyRound className="h-4 w-4 text-[var(--color-primary-dark)]" />Sign in with email &amp; password</p>
        <div>
          <label htmlFor="login-email" className="mb-2 block text-sm font-bold">Email</label>
          <Input id="login-email" type="email" autoComplete="username" placeholder="you@afyacommerce.test" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <label htmlFor="login-password" className="mb-2 block text-sm font-bold">Password</label>
          <Input id="login-password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {passError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{passError}</p>}
        <Button type="submit" variant="outline" className="w-full" disabled={passLoading}>{passLoading ? 'Signing in…' : 'Sign in securely'}</Button>
      </form>
      <p className="mt-7 text-center text-sm text-[var(--color-gray-500)]">New to AfyaCommerce? <Link href="/register" className="font-bold text-[var(--color-primary-dark)] hover:underline">Create an account</Link></p>
      <div className="mt-8 flex items-center justify-center gap-5 text-xs text-[var(--color-gray-500)]"><span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" />Encrypted</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />ODPC aligned</span></div>
    </div>
  );
}
