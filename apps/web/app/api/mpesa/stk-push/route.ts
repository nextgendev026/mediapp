import { NextResponse } from 'next/server';
import { callBackend, backendUnavailable, isResponse, requireCaller, upstreamError } from '@/lib/api/backend';
import { isValidKenyanPhone, normalizeKenyanPhone } from '@/lib/utils/validate-phone';

interface StkPushRequest {
  phone?: string;
  amount?: number;
  orderId?: string;
  orderNumber?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_NUMBER_PATTERN = /^AFY-[0-9]{4}-[0-9]{4,12}$/;

export async function POST(request: Request) {
  const caller = await requireCaller();
  if (isResponse(caller)) return caller;
  if (caller.profile.role !== 'patient') {
    return NextResponse.json({ error: 'Only patient accounts can pay for orders' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  let body: StkPushRequest;
  try {
    body = (await request.json()) as StkPushRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const amount = Number(body.amount);
  const orderId = typeof body.orderId === 'string' ? body.orderId : '';
  const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : '';

  if (!isValidKenyanPhone(phone)) {
    return NextResponse.json({ error: 'Enter a valid Kenyan phone number' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!UUID_PATTERN.test(orderId)) {
    return NextResponse.json({ error: 'Invalid order reference' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
    return NextResponse.json({ error: 'Invalid order number' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const response = await callBackend({
      path: '/api/mpesa/stk-push',
      method: 'POST',
      token: caller.accessToken,
      idempotencyKey: `web-${orderId}`,
      body: { phone: normalizeKenyanPhone(phone), amount, orderId, orderNumber }
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) return upstreamError(response.status, payload);
    const result = payload as {
      CheckoutRequestID?: unknown;
      MerchantRequestID?: unknown;
      ResponseCode?: unknown;
      CustomerMessage?: unknown;
    } | null;
    const checkoutRequestId = typeof result?.CheckoutRequestID === 'string' ? result.CheckoutRequestID : '';
    if (!checkoutRequestId) {
      return NextResponse.json({ error: 'M-PESA did not return a payment prompt' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(
      {
        CheckoutRequestID: checkoutRequestId,
        MerchantRequestID: typeof result?.MerchantRequestID === 'string' ? result.MerchantRequestID : undefined,
        ResponseCode: typeof result?.ResponseCode === 'string' ? result.ResponseCode : undefined,
        CustomerMessage: 'Check your phone and enter your M-PESA PIN to pay.'
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return backendUnavailable();
  }
}
