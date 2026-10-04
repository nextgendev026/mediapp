'use client';

import { CalendarDays, Check, Clock3, MapPin, MessageCircle, Stethoscope, Video } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatKES } from '@/lib/utils/format-currency';

interface Provider {
  id: string;
  fullName: string;
  specialty: string;
  county: string;
  feeFromKes: number;
}

type Mode = 'video' | 'chat' | 'in_person';

interface ModeOption {
  value: Mode;
  label: string;
  fee: number;
  hint: string;
  icon: React.ElementType;
}

interface BookingResult {
  providerName: string;
  specialty: string;
  date: string;
  time: string;
  mode: Mode;
  feeKes: number;
  reason: string;
  invoiceId: string | null;
}

const MODE_OPTIONS: ModeOption[] = [
  { value: 'video', label: 'Video', fee: 1200, hint: 'Face-to-face video call', icon: Video },
  { value: 'chat', label: 'Chat', fee: 800, hint: 'Secure text consultation', icon: MessageCircle },
  { value: 'in_person', label: 'In-person', fee: 1500, hint: 'Visit the clinic', icon: Stethoscope }
];

function buildSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 9; hour <= 17; hour += 1) {
    const hh = String(hour).padStart(2, '0');
    slots.push(`${hh}:00`);
    if (hour < 17) slots.push(`${hh}:30`);
  }
  return slots;
}

const SLOTS = buildSlots();

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function displayDate(date: string): string {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-KE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function modeLabel(mode: Mode): string {
  return mode === 'in_person' ? 'In-person' : mode === 'video' ? 'Video' : 'Chat';
}

export default function BookConsultationPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [mode, setMode] = useState<Mode>('video');
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  async function loadProviders(): Promise<void> {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/providers', { headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as { providers?: Provider[] };
      setProviders(data.providers ?? []);
    } catch {
      setLoadError('We could not load available clinicians. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProviders();
  }, []);

  const selected = providers.find((provider) => provider.id === providerId);
  const selectedMode = MODE_OPTIONS.find((option) => option.value === mode) ?? MODE_OPTIONS[0];
  const feeKes = selectedMode ? selectedMode.fee : 1200;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!selected) {
      setError('Choose a clinician to continue.');
      return;
    }
    if (!date) {
      setError('Pick a date for your consultation.');
      return;
    }
    if (!time) {
      setError('Pick a time slot for your consultation.');
      return;
    }
    if (reason.trim().length < 10) {
      setError('Describe your concern in at least 10 characters so the clinician can prepare.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify({ providerId: selected.id, date, time, mode, reason: reason.trim() })
      });
      const data = (await res.json().catch(() => ({}))) as {
        appointment?: { id: string };
        invoiceId?: string | null;
        error?: string;
      };
      if (res.status === 201 && data.appointment) {
        setResult({
          providerName: selected.fullName,
          specialty: selected.specialty,
          date,
          time,
          mode,
          feeKes,
          reason: reason.trim(),
          invoiceId: typeof data.invoiceId === 'string' ? data.invoiceId : null
        });
        return;
      }
      setError(data.error ?? 'We could not book this consultation. Please try another slot.');
    } catch {
      setError('Something went wrong while booking. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Care"
        title="Book a consultation"
        description="Consult licensed Kenyan clinicians over video, chat, or in person, and pay your consultation fee securely with M-PESA."
        backHref="/consultations"
      />

      {result ? (
        <Card className="mx-auto max-w-2xl p-6 text-center sm:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]">
            <Check className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="eyebrow mt-5">Consultation confirmed</p>
          <h2 className="mt-2 text-balance text-2xl font-extrabold">Your appointment is booked</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--color-gray-600)]">
            {result.providerName} · {result.specialty}
          </p>
          <div className="mx-auto mt-5 grid max-w-md gap-3 text-left sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-3 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
              {displayDate(result.date)}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-3 text-sm font-semibold">
              <Clock3 className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
              {result.time}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-3 text-sm font-semibold">
              <Video className="h-4 w-4 text-[var(--color-secondary)]" aria-hidden="true" />
              {modeLabel(result.mode)} consultation
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-3 text-sm font-semibold">
              <Stethoscope className="h-4 w-4 text-[var(--color-secondary)]" aria-hidden="true" />
              {formatKES(result.feeKes)} payable
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--color-gray-500)]">
            Reason: {result.reason}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {result.invoiceId && (
              <Link href={`/invoice/${result.invoiceId}`}>
                <Button className="w-full sm:w-auto">View invoice</Button>
              </Link>
            )}
            <Link href="/consultations">
              <Button variant="outline" className="w-full sm:w-auto">
                My consultations
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_0.4fr]">
          <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
            <Card>
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-[var(--color-primary)]" aria-hidden="true" />
                <h2 className="text-balance font-extrabold">1. Choose a clinician</h2>
              </div>
              {loading && <p className="mt-4 text-sm font-semibold text-[var(--color-gray-500)]">Loading available clinicians…</p>}
              {loadError && (
                <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">
                  <p>{loadError}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadProviders()}>
                    Try again
                  </Button>
                </div>
              )}
              {!loading && !loadError && providers.length === 0 && (
                <p className="mt-4 text-sm font-semibold text-[var(--color-gray-500)]">No clinicians are available right now.</p>
              )}
              {!loading && !loadError && providers.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {providers.map((provider) => {
                    const active = provider.id === providerId;
                    return (
                      <button
                        type="button"
                        key={provider.id}
                        onClick={() => setProviderId(provider.id)}
                        aria-pressed={active}
                        className={`flex min-h-11 w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                          active
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                            : 'border-[var(--color-gray-200)] hover:border-[#b9ebca]'
                        }`}
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d8f5e1] text-xs font-extrabold text-[var(--color-primary-dark)]">
                          {initials(provider.fullName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-extrabold">{provider.fullName}</span>
                          <span className="mt-0.5 block truncate text-xs text-[var(--color-gray-500)]">
                            {provider.specialty}
                            {provider.county ? ` · ${provider.county}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-extrabold">From {formatKES(provider.feeFromKes)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[var(--color-primary)]" aria-hidden="true" />
                <h2 className="text-balance font-extrabold">2. Pick a date and time</h2>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">Date</span>
                  <Input type="date" min={todayISO()} value={date} onChange={(event) => setDate(event.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">Time</span>
                  <Select value={time} onChange={(event) => setTime(event.target.value)}>
                    <option value="">Select a time</option>
                    {SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-gray-500)]">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                Clinic hours 09:00–17:00, Monday to Saturday.
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-[var(--color-secondary)]" aria-hidden="true" />
                <h2 className="text-balance font-extrabold">3. How would you like to connect?</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {MODE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const active = option.value === mode;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setMode(option.value)}
                      aria-pressed={active}
                      className={`flex min-h-11 flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                        active
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                          : 'border-[var(--color-gray-200)] hover:border-[#b9ebca]'
                      }`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-extrabold">
                          <Icon className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
                          {option.label}
                        </span>
                        <span className="text-sm font-extrabold">{formatKES(option.fee)}</span>
                      </span>
                      <span className="text-xs text-[var(--color-gray-500)]">{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[var(--color-primary)]" aria-hidden="true" />
                <h2 className="text-balance font-extrabold">4. What would you like to discuss?</h2>
              </div>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">Reason for consultation</span>
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Describe your symptoms, how long you have had them, and anything the clinician should know."
                  aria-describedby="reason-help"
                />
              </label>
              <p id="reason-help" className="mt-1.5 text-xs font-semibold text-[var(--color-gray-500)]">
                At least 10 characters. This is shared with your clinician only.
              </p>
            </Card>

            {error && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[var(--color-gray-500)]">
                Consultation fee {formatKES(feeKes)} is invoiced instantly and payable via M-PESA before your appointment.
              </p>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? 'Booking…' : `Book for ${formatKES(feeKes)}`}
              </Button>
            </div>
          </form>

          <Card className="h-fit">
            <p className="eyebrow">Your booking</p>
            <h2 className="mt-2 text-balance text-lg font-extrabold">Summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--color-gray-100)] pb-3">
                <dt className="flex items-center gap-2 text-[var(--color-gray-500)]">
                  <Stethoscope className="h-4 w-4" aria-hidden="true" />Clinician
                </dt>
                <dd className="text-right font-bold">{selected ? selected.fullName : 'Not selected'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-b border-[var(--color-gray-100)] pb-3">
                <dt className="flex items-center gap-2 text-[var(--color-gray-500)]">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />Date
                </dt>
                <dd className="text-right font-bold">{date ? displayDate(date) : 'Not selected'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-b border-[var(--color-gray-100)] pb-3">
                <dt className="flex items-center gap-2 text-[var(--color-gray-500)]">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />Time
                </dt>
                <dd className="text-right font-bold">{time || 'Not selected'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-b border-[var(--color-gray-100)] pb-3">
                <dt className="flex items-center gap-2 text-[var(--color-gray-500)]">
                  <Video className="h-4 w-4" aria-hidden="true" />Mode
                </dt>
                <dd className="text-right font-bold">{modeLabel(mode)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-2 text-[var(--color-gray-500)]">
                  <MapPin className="h-4 w-4" aria-hidden="true" />Fee
                </dt>
                <dd className="text-right font-extrabold">{formatKES(feeKes)}</dd>
              </div>
            </dl>
            <p className="mt-4 rounded-xl bg-[var(--color-primary-light)] p-3 text-xs leading-5 text-[var(--color-primary-dark)]">
              Licensed clinicians · KMPDC registered · Pay with M-PESA after booking.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
