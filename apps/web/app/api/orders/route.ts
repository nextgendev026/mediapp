import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isResponse, requireCaller } from '@/lib/api/backend';
import { isValidKenyanPhone, normalizeKenyanPhone } from '@/lib/utils/validate-phone';

interface CreateOrderRequest {
  items?: { slug?: string; quantity?: number }[];
  delivery?: { phone?: string; county?: string; landmark?: string; method?: string; notes?: string };
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DELIVERY_FEE_KES = 200;
const PICKUP_FEE_KES = 0;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const caller = await requireCaller();
  if (isResponse(caller)) return caller;
  if (caller.profile.role !== 'patient') {
    return NextResponse.json({ error: 'Only patient accounts can place orders' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const suppliedKey = request.headers.get('Idempotency-Key')?.trim() ?? '';
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(suppliedKey)) {
    return NextResponse.json({ error: 'An idempotency key is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  let body: CreateOrderRequest;
  try {
    body = (await request.json()) as CreateOrderRequest;
  } catch {
    return badRequest('Invalid request body');
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) return badRequest('Your cart is empty');

  const items: { slug: string; quantity: number }[] = [];
  for (const item of rawItems) {
    const slug = typeof item?.slug === 'string' ? item.slug.trim().toLowerCase() : '';
    const quantity = Number(item?.quantity);
    if (!SLUG_PATTERN.test(slug)) return badRequest('Your cart contains an unknown product');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return badRequest('Your cart contains an invalid quantity');
    items.push({ slug, quantity });
  }

  const method = body.delivery?.method === 'pickup' ? 'pickup_point' : body.delivery?.method === 'clinic' ? 'clinic_collection' : 'boda';
  const address: Record<string, string> = {};
  if (method !== 'pickup_point') {
    const phone = body.delivery?.phone?.trim() ?? '';
    const county = body.delivery?.county?.trim() ?? '';
    const landmark = body.delivery?.landmark?.trim() ?? '';
    if (!isValidKenyanPhone(phone)) return badRequest('Enter a valid delivery phone number');
    if (!county) return badRequest('Select a delivery county');
    if (landmark.length < 3) return badRequest('Add a landmark so the rider can find you');
    address.phone = normalizeKenyanPhone(phone);
    address.county = county;
    address.landmark = landmark.slice(0, 160);
    if (body.delivery?.notes) address.notes = body.delivery.notes.slice(0, 240);
  }

  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Ordering is temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const { data, error } = await supabase.rpc('create_order', {
    p_items: items,
    p_delivery_address: address,
    p_delivery_method: method,
    p_delivery_fee_kes: method === 'pickup_point' ? PICKUP_FEE_KES : DELIVERY_FEE_KES
  });

  if (error) {
    const detail = error.message ?? '';
    if (/consent is required/i.test(detail)) {
      return NextResponse.json({ error: 'Please accept the processing consent before ordering', code: 'consent_required' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }
    if (/insufficient stock|is not available|has expired|not currently accepting|same pharmacy|requires a valid prescription|county/i.test(detail)) {
      return NextResponse.json({ error: detail, code: 'order_rejected' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    if (/already exists|duplicate key/i.test(detail)) {
      return NextResponse.json({ error: 'This order was already submitted', code: 'duplicate' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ error: 'We could not create your order. Please try again.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  const order = (data ?? {}) as {
    id?: string;
    order_number?: string;
    total_kes?: number | string;
    subtotal_kes?: number | string;
    delivery_fee_kes?: number | string;
  };
  if (typeof order.id !== 'string' || typeof order.order_number !== 'string') {
    return NextResponse.json({ error: 'We could not create your order. Please try again.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json(
    {
      id: order.id,
      orderNumber: order.order_number,
      total: Number(order.total_kes ?? 0),
      subtotal: Number(order.subtotal_kes ?? 0),
      deliveryFee: Number(order.delivery_fee_kes ?? 0)
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } }
  );
}
