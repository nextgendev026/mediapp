export interface MpesaPaymentRequest {
  phone: string;
  amount: number;
  orderId: string;
  orderNumber: string;
}

export interface MpesaPaymentResponse {
  CheckoutRequestID?: string;
  MerchantRequestID?: string;
  ResponseCode?: string;
  CustomerMessage?: string;
  error?: string;
}

export interface MpesaPaymentStatus {
  status: 'initiated' | 'pending' | 'succeeded' | 'failed' | 'reversed' | 'unknown';
  mpesa_receipt_number?: string;
}

const apiBase = process.env.NEXT_PUBLIC_MPESA_API_BASE ?? '';

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; CustomerMessage?: string };
    const message = data.error ?? data.CustomerMessage;
    if (typeof message === 'string' && message.trim().length > 0 && message.length <= 200) return message;
  } catch {
    return fallback;
  }
  return fallback;
}

export async function initiateMpesaPayment(request: MpesaPaymentRequest): Promise<MpesaPaymentResponse> {
  const response = await fetch(`${apiBase}/api/mpesa/stk-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(await readError(response, 'Unable to start M-PESA payment. Please try again.'));
  return (await response.json()) as MpesaPaymentResponse;
}

export async function getMpesaPaymentStatus(checkoutRequestId: string): Promise<MpesaPaymentStatus> {
  const response = await fetch(`${apiBase}/api/mpesa/status/${encodeURIComponent(checkoutRequestId)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to check payment status');
  return (await response.json()) as MpesaPaymentStatus;
}
