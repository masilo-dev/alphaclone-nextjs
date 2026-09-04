/**
 * Phase 5 — legacy scanner delegation into Universal Chaser.
 */

import 'server-only';

import { shouldDelegateLegacyScannersToChaser } from '@/lib/chaser/chaseConfig';
import { runChaseScanForTenant } from '@/lib/chaser/chaseDetector';
import { executeDueChasesForTenant } from '@/lib/chaser/chaseExecutorService';

export type LegacyDelegationResult = {
  delegated: boolean;
  scan?: Awaited<ReturnType<typeof runChaseScanForTenant>>;
  execution?: Awaited<ReturnType<typeof executeDueChasesForTenant>>;
};

/** When phase >= 5, upsert canonical chases and execute due work instead of legacy send loops. */
export async function delegateLegacyFollowUpToChaser(
  tenantId: string,
  source: string,
): Promise<LegacyDelegationResult> {
  if (!shouldDelegateLegacyScannersToChaser()) {
    return { delegated: false };
  }

  const scan = await runChaseScanForTenant(tenantId);
  const execution = await executeDueChasesForTenant(tenantId);
  return {
    delegated: true,
    scan: { ...scan, byPolicy: { ...scan.byPolicy, [`legacy:${source}`]: 1 } },
    execution,
  };
}

export async function delegateLegacyFollowUpAllTenants(
  source: string,
  limit = 50,
): Promise<{ tenants: number; delegated: number }> {
  if (!shouldDelegateLegacyScannersToChaser()) {
    return { tenants: 0, delegated: 0 };
  }

  const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
  const admin = createSupabaseAdminClient();
  const { data: tenants } = await admin.from('tenants').select('id').limit(limit);
  let delegated = 0;
  for (const t of tenants || []) {
    await delegateLegacyFollowUpToChaser(t.id, source);
    delegated += 1;
  }
  return { tenants: tenants?.length || 0, delegated };
}
