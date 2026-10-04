import { NextResponse } from 'next/server';
import { callBackend, backendUnavailable, isResponse, requireCaller, upstreamError } from '@/lib/api/backend';

const REFERENCE_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'reversed']);

export async function GET(request: Request, { params }: { params: { reference: string } }) {
  const caller = await requireCaller();
  if (isResponse(caller)) return caller;

  const reference = params.reference?.trim() ?? '';
  if (!REFERENCE_PATTERN.test(reference)) {
    return NextResponse.json({ status: 'unknown' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const response = await callBackend({ path: `/api/mpesa/status/${encodeURIComponent(reference)}`, token: caller.accessToken });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ status: 'unknown' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
      }
      return upstreamError(response.status, payload);
    }
    const result = payload as { status?: unknown; mpesa_receipt?: unknown; mpesa_receipt_number?: unknown } | null;
    const status = typeof result?.status === 'string' ? result.status : 'pending';
    const receipt = result?.mpesa_receipt_number ?? result?.mpesa_receipt;
    return NextResponse.json(
      {
        status: TERMINAL_STATUSES.has(status) || status === 'pending' ? status : 'unknown',
        mpesa_receipt_number: typeof receipt === 'string' ? receipt : undefined
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return backendUnavailable();
  }
}
