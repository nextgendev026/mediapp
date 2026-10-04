'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CancelAppointmentButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' },
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Could not cancel this consultation.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not cancel this consultation. Check your connection.');
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => void cancel()} disabled={pending}>
        {pending ? 'Cancelling…' : 'Cancel'}
      </Button>
      {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
    </span>
  );
}
