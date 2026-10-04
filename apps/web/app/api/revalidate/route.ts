import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const provided = request.headers.get('x-revalidate-secret');
  if (secret && provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  revalidateTag('catalog');
  revalidateTag('orders');
  return NextResponse.json({ revalidated: true, now: Date.now() });
}
