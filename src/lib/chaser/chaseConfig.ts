/**
 * Universal Chaser rollout config — phases 1–4 and per-tenant/per-policy flags.
 */

import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ChaseAutomationMode, ChasePolicyKey } from '@/lib/chaser/types';

export type UniversalChaserPhase = 1 | 2 | 3 | 4;

export function getUniversalChaserPhase(): UniversalChaserPhase {
  const raw = Number(process.env.UNIVERSAL_CHASER_PHASE || process.env.UNIVERSAL_CHASER_MODE);
  if (raw === 2 || raw === 3 || raw === 4) return raw;
  if (process.env.UNIVERSAL_CHASER_MODE === 'automated') return 4;
  if (process.env.UNIVERSAL_CHASER_MODE === 'approval') return 3;
  if (process.env.UNIVERSAL_CHASER_MODE === 'internal') return 2;
  return 1;
}

export function isChaserGloballyEnabled(): boolean {
  return process.env.UNIVERSAL_CHASER_DISABLED !== 'true';
}

export async function isChaserEnabledForTenant(tenantId: string): Promise<boolean> {
  if (!isChaserGloballyEnabled()) return false;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('tenants')
    .select('settings, features, metadata')
    .eq('id', tenantId)
    .maybeSingle();
  const settings = (data?.settings || {}) as Record<string, unknown>;
  const features = (data?.features || {}) as Record<string, unknown>;
  const metadata = (data?.metadata || {}) as Record<string, unknown>;
  const flags = (metadata.feature_flags || {}) as Record<string, unknown>;
  if (settings.universal_chaser_enabled === false) return false;
  if (features.universal_chaser_enabled === false) return false;
  if (flags.universal_chaser_enabled === false) return false;
  return true;
}

export async function isPolicyEnabledForTenant(
  tenantId: string,
  policyKey: ChasePolicyKey,
): Promise<boolean> {
  if (!(await isChaserEnabledForTenant(tenantId))) return false;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .maybeSingle();
  const chaserPolicies = ((data?.settings as Record<string, unknown>)?.chaser_policies ||
    {}) as Record<string, boolean>;
  if (chaserPolicies[policyKey] === false) return false;
  const envKey = `CHASER_POLICY_${policyKey.toUpperCase()}_DISABLED`;
  if (process.env[envKey] === 'true') return false;
  return true;
}

export function resolveEffectiveAutomationMode(params: {
  policyDefault: ChaseAutomationMode;
  policyApprovalRequired: boolean;
  tenantOverride?: ChaseAutomationMode | null;
}): ChaseAutomationMode {
  const phase = getUniversalChaserPhase();
  if (phase === 1) return 'observe_only';
  if (phase === 2) return 'internal';
  if (phase === 3) {
    if (params.tenantOverride === 'automated') return 'approval_required';
    return params.policyApprovalRequired ? 'approval_required' : 'internal';
  }
  return params.tenantOverride || params.policyDefault;
}

export const CHASER_CONCURRENCY = {
  ai: () => Number(process.env.MCP_AI_CONCURRENCY || 2),
  email: () => Number(process.env.EMAIL_CONCURRENCY || 5),
  social: () => Number(process.env.SOCIAL_CONCURRENCY || 2),
  crmScan: () => Number(process.env.CHASER_CRM_SCAN_CHUNK || 25),
};
