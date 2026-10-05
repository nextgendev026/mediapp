import 'server-only';

import {
  activeBlocks,
  blockTarget,
  isBlocked,
  recordEvent,
  recentEvents,
  unblockTarget,
  type Block,
  type Severity,
  type ThreatAssessment
} from './intrusion-detection';
import { clientIp } from '../server/security';

const FAILED_LOGIN_THRESHOLD = 5;
const FAILED_LOGIN_WINDOW_MS = 5 * 60 * 1000;
const ACCOUNT_LOCK_TTL_MS = 15 * 60 * 1000;
const IP_BLOCK_TTL_MS = 30 * 60 * 1000;
const SEVERE_IP_BLOCK_TTL_MS = 2 * 60 * 60 * 1000;
const LOCKDOWN_TTL_MS = 30 * 60 * 1000;

const failureCounts = new Map<string, { count: number; resetAt: number }>();
let lockdownUntil = 0;
let lastSweep = Date.now();

function sweep(): void {
  const now = Date.now();
  if (now - lastSweep < 30_000) return;
  for (const [k, v] of failureCounts) {
    if (v.resetAt <= now) failureCounts.delete(k);
  }
  lastSweep = now;
}

export function isLockdown(): boolean {
  return Date.now() < lockdownUntil;
}

export async function triggerLockdown(reason: string, ip?: string): Promise<void> {
  lockdownUntil = Date.now() + LOCKDOWN_TTL_MS;
  await recordEvent({
    type: 'lockdown',
    severity: 'critical',
    ip,
    detail: { reason, durationMs: LOCKDOWN_TTL_MS },
    actionTaken: 'global_lockdown_enabled'
  });
}

export async function handleFailedLogin(ip: string, accountId?: string): Promise<void> {
  sweep();
  const key = accountId ? `acct:${accountId}` : `ip:${ip}`;
  const now = Date.now();
  const entry = failureCounts.get(key);
  if (!entry || entry.resetAt <= now) {
    failureCounts.set(key, { count: 1, resetAt: now + FAILED_LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }

  const count = failureCounts.get(key)?.count ?? 1;
  await recordEvent({
    type: 'failed_login',
    severity: count >= FAILED_LOGIN_THRESHOLD ? 'high' : 'medium',
    ip,
    accountId,
    detail: { count, threshold: FAILED_LOGIN_THRESHOLD }
  });

  if (count >= FAILED_LOGIN_THRESHOLD) {
    if (accountId) {
      await blockTarget(accountId, 'account', 'too_many_failed_logins', 'high', ACCOUNT_LOCK_TTL_MS);
      await recordEvent({
        type: 'auto_mend',
        severity: 'high',
        ip,
        accountId,
        detail: { action: 'account_locked', ttlMs: ACCOUNT_LOCK_TTL_MS },
        actionTaken: 'account_auto_locked'
      });
    } else {
      await blockTarget(ip, 'ip', 'too_many_failed_logins', 'high', IP_BLOCK_TTL_MS);
      await recordEvent({
        type: 'auto_mend',
        severity: 'high',
        ip,
        detail: { action: 'ip_blocked', ttlMs: IP_BLOCK_TTL_MS },
        actionTaken: 'ip_auto_blocked'
      });
    }
    failureCounts.delete(key);
  }
}

export async function handleThreat(ip: string, assessment: ThreatAssessment): Promise<void> {
  if (assessment.blocked) {
    const ttl = assessment.score >= 100 ? SEVERE_IP_BLOCK_TTL_MS : IP_BLOCK_TTL_MS;
    await blockTarget(ip, 'ip', assessment.reasons.join(','), assessment.score >= 100 ? 'critical' : 'high', ttl);
    await recordEvent({
      type: 'auto_mend',
      severity: assessment.score >= 100 ? 'critical' : 'high',
      ip,
      detail: { action: 'ip_blocked', reasons: assessment.reasons, score: assessment.score, ttlMs: ttl },
      actionTaken: 'ip_auto_blocked'
    });
    if (assessment.score >= 100) {
      await triggerLockdown(`severe_threat_score_${assessment.score}`, ip);
    }
  }
}

export async function checkAccess(ip: string, accountId?: string): Promise<{ allowed: boolean; block: Block | null }> {
  if (isLockdown()) {
    return { allowed: false, block: { target: 'global', kind: 'ip', reason: 'lockdown', severity: 'critical', blockedAt: new Date().toISOString(), expiresAt: new Date(lockdownUntil).toISOString(), auto: true } };
  }
  const block = await isBlocked(ip, accountId);
  return { allowed: !block, block };
}

export async function enforceCleanup(): Promise<void> {
  const blocks = await activeBlocks();
  const now = Date.now();
  for (const block of blocks) {
    if (block.expiresAt && new Date(block.expiresAt).getTime() <= now) {
      await unblockTarget(block.target);
      await recordEvent({
        type: 'auto_mend',
        severity: 'low',
        detail: { action: 'auto_unblocked', target: block.target, kind: block.kind },
        actionTaken: 'expired_block_lifted'
      });
    }
  }
}

export interface SecurityStatus {
  lockdown: boolean;
  lockdownRemainingMs: number;
  activeBlocks: Block[];
  recentEvents: Record<string, unknown>[];
  threatLevel: 'normal' | 'elevated' | 'high' | 'critical';
}

export async function getSecurityStatus(): Promise<SecurityStatus> {
  const blocks = await activeBlocks();
  const events = await recentEvents(50);
  const now = Date.now();
  const recentBlocks = blocks.filter((b) => now - new Date(b.blockedAt ?? now).getTime() < 3600_000).length;
  const criticalEvents = events.filter((e) => e.severity === 'critical').length;

  let threatLevel: SecurityStatus['threatLevel'] = 'normal';
  if (isLockdown() || criticalEvents > 0) threatLevel = 'critical';
  else if (recentBlocks >= 3) threatLevel = 'high';
  else if (recentBlocks >= 1) threatLevel = 'elevated';

  return {
    lockdown: isLockdown(),
    lockdownRemainingMs: Math.max(0, lockdownUntil - now),
    activeBlocks: blocks,
    recentEvents: events,
    threatLevel
  };
}

export { clientIp };
