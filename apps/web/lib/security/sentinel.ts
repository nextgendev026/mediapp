import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { clientIp, rateLimit } from '../server/security';
import { assessRequest } from './intrusion-detection';
import {
  checkAccess,
  enforceCleanup,
  handleThreat,
  isLockdown,
  triggerLockdown
} from './auto-mend';

const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

let cleanupScheduled = false;

function scheduleCleanup(): void {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  void enforceCleanup().finally(() => {
    cleanupScheduled = false;
  });
}

export interface GuardResult {
  allowed: boolean;
  response?: NextResponse;
}

export async function guardRequest(request: NextRequest, path: string): Promise<GuardResult> {
  scheduleCleanup();
  const ip = clientIp(request);

  if (isLockdown()) {
    return {
      allowed: false,
      response: new NextResponse('Service temporarily unavailable due to a security incident.', {
        status: 503,
        headers: { 'Retry-After': '60', 'Content-Type': 'text/plain' }
      })
    };
  }

  const access = await checkAccess(ip);
  if (!access.allowed) {
    return {
      allowed: false,
      response: new NextResponse(`Access denied: ${access.block?.reason ?? 'blocked'}`, {
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      })
    };
  }

  const rl = rateLimit(`guard:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.allowed) {
    return {
      allowed: false,
      response: new NextResponse('Too many requests.', {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSeconds), 'Content-Type': 'text/plain' }
      })
    };
  }

  const assessment = assessRequest(request, path);
  if (assessment.reasons.length > 0) {
    await handleThreat(ip, assessment);
    if (assessment.blocked) {
      return {
        allowed: false,
        response: new NextResponse('Request blocked by security policy.', {
          status: 403,
          headers: { 'Content-Type': 'text/plain' }
        })
      };
    }
  }

  return { allowed: true };
}

export { triggerLockdown };
