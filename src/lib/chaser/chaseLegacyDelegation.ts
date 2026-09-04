/**
 * Phase 5 — legacy scanner delegation into Universal Chaser.
 * @deprecated Prefer runChaseCronJob from chaseCronRunner.
 */

import 'server-only';

import { runChaseCronJob } from '@/lib/chaser/chaseCronRunner';

export type LegacyDelegationResult = {
  delegated: boolean;
  scan?: { detected: number; created: number; updated: number };
  execution?: { processed: number; executed: number; resolved: number };
};

/** @deprecated Use runChaseCronJob */
export async function delegateLegacyFollowUpToChaser(
  tenantId: string,
  source: string,
): Promise<LegacyDelegationResult> {
  const result = await runChaseCronJob(source as any, 1);
  return {
    delegated: result.mode === 'chaser',
    scan: result.scan,
    execution: result.execution,
  };
}

/** @deprecated Use runChaseCronJob */
export async function delegateLegacyFollowUpAllTenants(
  source: string,
  limit = 50,
): Promise<{ tenants: number; delegated: number }> {
  const result = await runChaseCronJob(source as any, limit);
  return {
    tenants: result.tenants || 0,
    delegated: result.mode === 'chaser' ? result.tenants || 0 : 0,
  };
}
