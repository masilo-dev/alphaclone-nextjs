/**
 * Signed single-use action tokens for owner email buttons.
 */

import { signPayload, verifySignedPayload } from '@/lib/security/signedToken';

export type ChaseEmailAction = 'approve' | 'snooze' | 'stop' | 'do_now';

export function signChaseActionToken(params: {
  tenantId: string;
  chaseId: string;
  ownerUserId: string;
  action: ChaseEmailAction;
  ttlSeconds?: number;
}): string {
  const payload = [
    params.tenantId,
    params.chaseId,
    params.ownerUserId,
    params.action,
  ].join(':');
  return signPayload(payload, params.ttlSeconds ?? 60 * 60 * 48);
}

export function verifyChaseActionToken(token: string): {
  tenantId: string;
  chaseId: string;
  ownerUserId: string;
  action: ChaseEmailAction;
} | null {
  const payload = verifySignedPayload(token);
  if (!payload) return null;
  const [tenantId, chaseId, ownerUserId, action] = payload.split(':');
  if (!tenantId || !chaseId || !ownerUserId || !action) return null;
  if (!['approve', 'snooze', 'stop', 'do_now'].includes(action)) return null;
  return {
    tenantId,
    chaseId,
    ownerUserId,
    action: action as ChaseEmailAction,
  };
}
