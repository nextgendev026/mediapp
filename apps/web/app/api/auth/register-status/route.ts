import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/server/settings';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

export async function GET() {
  let registrationOpen = true;
  try {
    const settings = await getSettings();
    registrationOpen = settings.registrationOpen;
  } catch {
    registrationOpen = true;
  }
  return NextResponse.json({ registrationOpen }, { headers: { 'Cache-Control': 'no-store' } });
}
