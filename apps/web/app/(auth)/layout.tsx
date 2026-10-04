import Link from 'next/link';
import { ArrowLeft, CheckCircle2, HeartPulse, ShieldCheck, Stethoscope } from 'lucide-react';
import { BrandMark } from '@/components/shared/BrandMark';
import { LanguageToggle } from '@/components/shared/LanguageToggle';

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(360px,0.8fr)_1.2fr]">
      <aside className="relative hidden overflow-hidden bg-[#092b1a] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#1da84a]/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#0066cc]/20 blur-3xl" />
        <div className="relative"><BrandMark /></div>
        <div className="relative max-w-md">
          <p className="eyebrow !text-[#8de5aa]">Care that travels with you</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight">Your health, delivered with dignity.</h1>
          <p className="mt-5 text-base leading-7 text-green-100/80">Connect with licensed clinicians, access trusted medicines, and follow every delivery from pharmacy to doorstep.</p>
          <div className="mt-8 space-y-4">
            {['Licensed Kenyan healthcare professionals', 'M-PESA checkout and discreet delivery', 'Your health data stays protected'].map((item) => <div key={item} className="flex items-center gap-3 text-sm font-semibold text-green-50"><CheckCircle2 className="h-5 w-5 text-[#8de5aa]" aria-hidden="true" />{item}</div>)}
          </div>
        </div>
        <div className="relative flex items-center gap-3 text-xs text-green-100/70"><ShieldCheck className="h-4 w-4" />ODPC-aligned privacy by design <span className="text-white/30">•</span> <HeartPulse className="h-4 w-4" />Built for Kenya</div>
      </aside>
      <main className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-5 py-5 lg:hidden"><BrandMark /><LanguageToggle /></header>
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-16">{children}</div>
        <footer className="flex items-center justify-between px-5 py-5 text-xs text-[var(--color-gray-500)] sm:px-8 lg:px-16"><Link href="/" className="inline-flex items-center gap-2 font-semibold hover:text-[var(--color-primary-dark)]"><ArrowLeft className="h-4 w-4" />Back to home</Link><span className="inline-flex items-center gap-1.5"><Stethoscope className="h-4 w-4" />Support: 0800 722 000</span></footer>
      </main>
    </div>
  );
}
