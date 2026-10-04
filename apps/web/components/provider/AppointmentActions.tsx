'use client';

import { Ban, CheckCircle2, FileText, UserX, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const mutationHeaders = { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' };

export function AppointmentActions({ id, status, invoiceId }: { id: string; status: string; invoiceId?: string | undefined }) {
  const router = useRouter();
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');

  async function update(next: string) {
    setPending(next);
    setError('');
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: mutationHeaders,
        body: JSON.stringify({ status: next })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Could not update the appointment.');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the appointment.');
    } finally {
      setPending('');
    }
  }

  const busy = pending !== '';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(status === 'booked' || status === 'completed') && (
        <Link href={`/provider/consultations/${id}`}>
          <Button size="sm">Open room</Button>
        </Link>
      )}
      {invoiceId && (
        <Link href={`/invoice/${invoiceId}`}>
          <Button size="sm" variant="outline">
            <FileText className="h-3.5 w-3.5" />
            Invoice
          </Button>
        </Link>
      )}
      {status === 'booked' && (
        <>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void update('completed')}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {pending === 'completed' ? 'Saving…' : 'Mark completed'}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void update('no_show')}>
            <Ban className="h-3.5 w-3.5" />
            {pending === 'no_show' ? 'Saving…' : 'No-show'}
          </Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => void update('cancelled')}>
            <XCircle className="h-3.5 w-3.5" />
            {pending === 'cancelled' ? 'Saving…' : 'Cancel'}
          </Button>
        </>
      )}
      {status !== 'booked' && status !== 'completed' && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-gray-500)]">
          <UserX className="h-3.5 w-3.5" />
          No further actions
        </span>
      )}
      {error && <p className="w-full text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
