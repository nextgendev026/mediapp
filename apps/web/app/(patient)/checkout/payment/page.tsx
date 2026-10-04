'use client';

import { CheckCircle2, Loader2, MessageCircle, PackageCheck, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { MpesaCheckout } from '@/components/checkout/MpesaCheckout';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCart } from '@/components/shared/AppProviders';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatKES } from '@/lib/utils/format-currency';

interface DeliveryDetails {
  fee: number;
  phone: string;
  county: string;
  landmark: string;
  method: string;
}

interface CreatedOrder {
  id: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  deliveryFee: number;
}

const DELIVERY_FEE_KES = 200;

function newIdempotencyKey(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  return `web-order-${random}`;
}

export default function PaymentCheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const [delivery, setDelivery] = useState<DeliveryDetails>({ fee: DELIVERY_FEE_KES, phone: '', county: '', landmark: '', method: 'boda' });
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [paid, setPaid] = useState(false);
  const [idempotencyKey] = useState(newIdempotencyKey);

  useEffect(() => {
    const stored = window.localStorage.getItem('afya-delivery');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Partial<DeliveryDetails>;
      setDelivery((current) => ({
        fee: typeof parsed.fee === 'number' ? parsed.fee : current.fee,
        phone: typeof parsed.phone === 'string' ? parsed.phone : current.phone,
        county: typeof parsed.county === 'string' ? parsed.county : current.county,
        landmark: typeof parsed.landmark === 'string' ? parsed.landmark : current.landmark,
        method: typeof parsed.method === 'string' ? parsed.method : current.method
      }));
    } catch {
      return;
    }
  }, []);

  const createOrder = useCallback(async (): Promise<CreatedOrder | null> => {
    setCreating(true);
    setError('');
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          items: items.map((item) => ({ slug: item.product.id, quantity: item.quantity })),
          delivery: {
            phone: delivery.phone,
            county: delivery.county,
            landmark: delivery.landmark,
            method: delivery.method,
            notes: ''
          }
        }),
        cache: 'no-store'
      });
      const payload = (await response.json()) as CreatedOrder & { error?: string };
      if (!response.ok || typeof payload.id !== 'string') {
        setError(payload.error ?? 'We could not create your order. Please try again.');
        return null;
      }
      const created: CreatedOrder = {
        id: payload.id,
        orderNumber: payload.orderNumber,
        total: payload.total,
        subtotal: payload.subtotal,
        deliveryFee: payload.deliveryFee
      };
      setOrder(created);
      clearCart();
      return created;
    } catch {
      setError('We could not reach the pharmacy service. Check your connection and try again.');
      return null;
    } finally {
      setCreating(false);
    }
  }, [clearCart, delivery, idempotencyKey, items]);

  if (order && paid) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-8 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <p className="eyebrow mt-6">Payment received</p>
          <h1 className="mt-2 text-3xl font-extrabold">Your order is confirmed</h1>
          <p className="mt-3 text-sm text-[var(--color-gray-500)]">Order number</p>
          <p className="mt-1 font-mono text-xl font-bold tracking-wider text-[var(--color-primary-dark)]">{order.orderNumber}</p>
          {receipt && <p className="mt-2 font-mono text-xs text-[var(--color-gray-500)]">M-PESA receipt {receipt}</p>}
          <div className="mx-auto mt-6 grid max-w-md gap-3 text-left sm:grid-cols-3">
            <div className="rounded-lg bg-[var(--color-gray-50)] p-3">
              <PackageCheck className="h-4 w-4 text-[var(--color-primary)]" />
              <p className="mt-2 text-xs font-bold">Pharmacy</p>
              <p className="mt-1 text-xs text-[var(--color-gray-500)]">Preparing your order</p>
            </div>
            <div className="rounded-lg bg-[var(--color-gray-50)] p-3">
              <MessageCircle className="h-4 w-4 text-[var(--color-secondary)]" />
              <p className="mt-2 text-xs font-bold">SMS update</p>
              <p className="mt-1 text-xs text-[var(--color-gray-500)]">Sent to {delivery.phone}</p>
            </div>
            <div className="rounded-lg bg-[var(--color-gray-50)] p-3">
              <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
              <p className="mt-2 text-xs font-bold">Chain of custody</p>
              <p className="mt-1 text-xs text-[var(--color-gray-500)]">Securely tracked</p>
            </div>
          </div>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={`/orders/${order.orderNumber}/track`}>
              <Button><PackageCheck className="mr-2 h-4 w-4" />Track my order</Button>
            </Link>
            <Link href="/pharmacy"><Button variant="outline">Continue shopping</Button></Link>
          </div>
        </Card>
      </div>
    );
  }

  const displayTotal = order ? order.total : subtotal + (delivery.method === 'pickup' ? 0 : delivery.fee);
  const deliveryFee = order ? order.deliveryFee : delivery.method === 'pickup' ? 0 : delivery.fee;

  return (
    <div>
      <PageHeader
        eyebrow="Step 2 of 2"
        title="Complete payment"
        description="We reserve your items with the pharmacy first, then you approve the M-PESA prompt on your phone."
        backHref="/checkout/delivery"
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_0.38fr]">
        <div className="space-y-4">
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
          {!order ? (
            items.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-sm text-[var(--color-gray-500)]">Your cart is empty.</p>
                <Link href="/pharmacy" className="mt-4 inline-block"><Button>Browse the pharmacy</Button></Link>
              </Card>
            ) : (
              <>
                <Button size="lg" className="w-full" disabled={creating} onClick={() => { void createOrder(); }}>
                  {creating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reserving your medicines…</>
                  ) : (
                    <>Reserve items and continue to payment · {formatKES(displayTotal)}</>
                  )}
                </Button>
                <p className="text-center text-xs text-[var(--color-gray-500)]">
                  Stock is confirmed by the pharmacy before you pay. Nothing is charged until you approve the M-PESA prompt.
                </p>
              </>
            )
          ) : (
            <>
              <Card className="border-[var(--color-primary-light)] bg-[var(--color-primary-light)]/40 p-4">
                <p className="text-sm font-bold text-[var(--color-primary-dark)]">Order {order.orderNumber} reserved</p>
                <p className="mt-1 text-xs text-[var(--color-gray-500)]">Pay {formatKES(order.total)} to confirm. If payment is not completed the reservation is released automatically.</p>
              </Card>
              <MpesaCheckout
                orderId={order.id}
                orderNumber={order.orderNumber}
                amount={order.total}
                onSuccess={(value) => {
                  setReceipt(value);
                  setPaid(true);
                }}
              />
            </>
          )}
        </div>
        <div className="space-y-4">
          <OrderSummary deliveryFee={deliveryFee} actionHref={undefined} />
          <Card>
            <p className="text-xs leading-5 text-[var(--color-gray-500)]">
              <strong className="text-[var(--color-gray-900)]">Delivering to:</strong><br />
              {delivery.landmark || 'Add a delivery landmark'}<br />
              {delivery.county || 'Select a county'} · {delivery.phone || 'Add a phone number'}
            </p>
            <p className="mt-3 text-xs text-[var(--color-gray-500)]">
              Total: <strong className="text-[var(--color-primary-dark)]">{formatKES(displayTotal)}</strong>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
