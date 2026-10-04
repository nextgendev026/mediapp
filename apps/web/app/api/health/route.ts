import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/store';
import { getSettings } from '@/lib/server/settings';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

async function readVersion(): Promise<string> {
  try {
    const raw = await fs.readFile(path.resolve(process.cwd(), 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as { name?: string; version?: string };
    const name = typeof pkg.name === 'string' ? pkg.name : '';
    const version = typeof pkg.version === 'string' ? pkg.version : '';
    if (name || version) return `${name}${version ? `@${version}` : ''}`;
  } catch {
    return '';
  }
  return '';
}

export async function GET() {
  let storeOk = false;
  try {
    await getDb();
    storeOk = true;
  } catch {
    storeOk = false;
  }

  let settingsOk = false;
  try {
    await getSettings();
    settingsOk = true;
  } catch {
    settingsOk = false;
  }

  const version = await readVersion();
  const status: 'ok' | 'degraded' = storeOk && settingsOk ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      uptimeSec: Math.round(process.uptime()),
      storeOk,
      checks: { db: storeOk ? 'ok' : 'fail', settings: settingsOk ? 'ok' : 'fail' },
      version,
      timestamp: new Date().toISOString()
    },
    { status: storeOk ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
