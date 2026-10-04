'use client';

import { Check, CreditCard, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getMpesaPaymentStatus, initiateMpesaPayment } from '@/lib/mpesa/client';
import { formatKES } from '@/lib/utils/format-currency';
import { isValidKenyanPhone, normalizeKenyanPhone } from '@/lib/utils/validate-phone';

interface MpesaCheckoutProps {
  orderId: string;
  orderNumber: string;
  amount: number;
  onSuccess: (receipt: string) => void;
}

type Method = 'mpesa' | 'airtel' | 'card' | 'sha';
type Status = 'idle' | 'pending' | 'success' | 'failed';

const METHOD_LABELS: Record<Method, string> = {
  mpesa: 'M-PESA',
  airtel: 'Airtel Money',
  card: 'Card',
  sha: 'SHA insurance'
};

const UNAVAILABLE: Record<Exclude<Method, 'mpesa'>, string> = {
  airtel: 'Airtel Money checkout is not available yet. Pay with M-PESA or choose another payment arrangement at the pharmacy.',
  card: 'Card payments are not available yet. Pay with M-PESA to keep your order moving.',
  sha: 'SHA insurance settlement is completed by the pharmacy after your order is confirmed. Pay with M-PESA now if you need same-day delivery.'
};

const MAX_POLLS = 30;
const POLL_INTERVAL_MS = 3000;

export function MpesaCheckout({ orderId, orderNumber, amount, onSuccess }: MpesaCheckoutProps) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState('');
  const [method, setMethod] = useState<Method>('mpesa');
  const pollTimer = useRef<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pollTimer.current !== null) window.clearTimeout(pollTimer.current);
    };
  }, []);

  const isMpesa = method === 'mpesa';

  async function handlePayment() {
    setMessage('');
    if (!isMpesa) {
      setMessage(UNAVAILABLE[method as Exclude<Method, 'mpesa'>]);
      return;
    }
    if (!isValidKenyanPhone(phone)) {
      setMessage('Enter a valid M-PESA number, for example 0712 345 678.');
      return;
    }
    setLoading(true);
    setStatus('pending');
    try {
      const response = await initiateMpesaPayment({
        phone: normalizeKenyanPhone(phone),
        amount: Math.round(amount),
        orderId,
        orderNumber
      });
      const checkoutRequestId = response.CheckoutRequestID;
      if (!checkoutRequestId) throw new Error('M-PESA did not return a payment prompt. Please try again.');
      let attempts = 0;
      const poll = async () => {
        attempts += 1;
        try {
          const result = await getMpesaPaymentStatus(checkoutRequestId);
          if (!mounted.current) return;
          if (result.status === 'succeeded') {
            setLoading(false);
            setStatus('success');
            setReceipt(result.mpesa_receipt_number ?? '');
            onSuccess(result.mpesa_receipt_number ?? '');
            return;
          }
          if (result.status === 'failed' || result.status === 'reversed') {
            setLoading(false);
            setStatus('failed');
            setMessage('The payment did not complete. No money was taken. Please try again.');
            return;
          }
        } catch {
          if (attempts >= MAX_POLLS) {
            setLoading(false);
            setStatus('failed');
            setMessage('We could not confirm your payment yet. Check your M-PESA history before retrying.');
            return;
          }
        }
        if (attempts >= MAX_POLLS) {
          setLoading(false);
          setStatus('failed');
          setMessage('We could not confirm your payment in time. Check your M-PESA history before retrying.');
          return;
        }
        pollTimer.current = window.setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
      };
      pollTimer.current = window.setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
    } catch (error) {
      if (!mounted.current) return;
      setLoading(false);
      setStatus('failed');
      setMessage(error instanceof Error ? error.message : 'Payment could not be started. Please try again.');
    }
  }

  function selectMethod(next: Method) {
    if (pollTimer.current !== null) window.clearTimeout(pollTimer.current);
    setMethod(next);
    setStatus('idle');
    setMessage('');
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1da84a] text-sm font-black text-white">M</span>
          Payment method
        </CardTitle>
        <p className="text-sm text-[var(--color-gray-500)]">Choose how you would like to pay securely.</p>
      </CardHeader>
      <CardContent>
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button type="button" onClick={() => selectMethod('mpesa')} aria-pressed={method === 'mpesa'} className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-bold ${method === 'mpesa' ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]' : 'border-[var(--color-gray-200)] text-[var(--color-gray-600)]'}`}><span className="flex h-7 w-7 items-center justify-center rounded bg-[#1da84a] text-white">M</span>M-PESA</button>
          <button type="button" onClick={() => selectMethod('airtel')} aria-pressed={method === 'airtel'} className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-bold ${method === 'airtel' ? 'border-[#c2410c] bg-orange-50 text-[#c2410c]' : 'border-[var(--color-gray-200)] text-[var(--color-gray-600)]'}`}><span className="flex h-7 w-7 items-center justify-center rounded bg-[#ef5b24] text-white text-[10px] font-black">airtel</span>Airtel Money</button>
          <button type="button" onClick={() => selectMethod('card')} aria-pressed={method === 'card'} className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-bold ${method === 'card' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-[var(--color-gray-200)] text-[var(--color-gray-600)]'}`}><CreditCard className="h-6 w-6" />Card</button>
          <button type="button" onClick={() => selectMethod('sha')} aria-pressed={method === 'sha'} className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-bold ${method === 'sha' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-[var(--color-gray-200)] text-[var(--color-gray-600)]'}`}><ShieldCheck className="h-6 w-6" />SHA insurance</button>
        </div>

        {isMpesa ? (
          <div>
            <label htmlFor="mpesa-phone" className="mb-2 block text-sm font-bold">M-PESA phone number</label>
            <div className="relative">
              <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gray-500)]" aria-hidden="true" />
              <Input id="mpesa-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXX" value={phone} onChange={(event) => setPhone(event.target.value)} className="pl-10" aria-describedby="mpesa-phone-help" />
            </div>
            <p id="mpesa-phone-help" className="mt-2 text-xs text-[var(--color-gray-500)]">We will send a payment prompt to this Safaricom number.</p>
          </div>
        ) : (
          <div className="rounded-lg bg-[var(--color-gray-50)] p-4 text-sm leading-6 text-[var(--color-gray-600)]">
            <Badge tone="primary" className="mb-2">{METHOD_LABELS[method]}</Badge>
            <p>{UNAVAILABLE[method as Exclude<Method, 'mpesa'>]}</p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--color-gray-500)]">Amount due <strong className="text-[var(--color-gray-900)]">{formatKES(amount)}</strong></p>
          <Button onClick={handlePayment} disabled={loading || status === 'success'} size="lg">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Waiting for confirmation…</> : status === 'success' ? <><Check className="mr-2 h-4 w-4" />Paid</> : <>Pay {formatKES(amount)}</>}
          </Button>
        </div>

        {message && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{message}</p>}
        {status === 'success' && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">Payment confirmed{receipt ? `. Receipt ${receipt}` : '.'}</p>}
      </CardContent>
    </Card>
  );
}
