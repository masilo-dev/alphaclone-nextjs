import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  resolveEntitlementContext,
  shouldEnforceDailyQuota,
  type TenantEntitlementSnapshot,
} from '@/lib/entitlements/entitlementContext';
import { normalizePlanId } from '@/lib/entitlements/planEntitlements';
import type { QuotaResourceType } from '@/lib/entitlements/planEntitlements';
import { recordUsageEvent } from '@/lib/email/usageMeteringService';

export type MeteringResult = {
  allowed: boolean;
  charged: boolean;
  skipped: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
  unlimited?: boolean;
};

async function loadTenantSnapshot(tenantId: string): Promise<TenantEntitlementSnapshot | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('tenants')
    .select(
      'id, subscription_plan, subscription_status, created_at, trial_started_at, trial_ends_at, legacy_access_until, stripe_subscription_id',
    )
    .eq('id', tenantId)
    .maybeSingle();
  if (!data) return null;
  const rawPlan = data.subscription_plan || 'free';
  return {
    tenantId: data.id,
    rawPlan,
    normalizedPlan: normalizePlanId(rawPlan),
    subscriptionStatus: data.subscription_status || 'free',
    createdAt: data.created_at ? new Date(data.created_at) : null,
    trialStartedAt: data.trial_started_at ? new Date(data.trial_started_at) : null,
    trialEndsAt: data.trial_ends_at ? new Date(data.trial_ends_at) : null,
    legacyAccessUntil: data.legacy_access_until ? new Date(data.legacy_access_until) : null,
    stripeSubscriptionId: data.stripe_subscription_id || null,
  };
}

/**
 * Check whether a projected amount would exceed limits — never increments counters.
 */
export async function validateProjectedUsage(
  tenantId: string,
  userId: string,
  resource: QuotaResourceType,
  amount = 1,
): Promise<MeteringResult> {
  const snapshot = await loadTenantSnapshot(tenantId);
  if (!snapshot) {
    return { allowed: false, charged: false, skipped: false, reason: 'Workspace not found' };
  }

  const entitlement = resolveEntitlementContext(snapshot);
  if (!shouldEnforceDailyQuota(entitlement)) {
    return { allowed: true, charged: false, skipped: true, unlimited: true, reason: 'Quota not enforced for this account' };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('check_daily_resource_quota', {
    p_tenant_id: tenantId,
    p_user_id: userId,
    p_resource: resource,
    p_amount: amount,
  });

  if (error) {
    console.error('[metering] validateProjectedUsage RPC error:', error);
    return { allowed: false, charged: false, skipped: false, reason: 'Unable to verify usage allowance' };
  }

  const allowed = Boolean(data?.allowed);
  return {
    allowed,
    charged: false,
    skipped: false,
    currentUsage: Number(data?.currentUsage || 0),
    limit: Number(data?.limit ?? -1),
    unlimited: Boolean(data?.unlimited),
    reason: allowed ? undefined : String(data?.message || 'Daily limit would be exceeded'),
  };
}

/**
 * Increment usage only after a successful, persisted business action.
 * Idempotent when operationId is supplied.
 */
export async function recordSuccessfulUsage(params: {
  tenantId: string;
  userId: string;
  resource: QuotaResourceType;
  amount?: number;
  operationId?: string;
  initiationSource: string;
  metadata?: Record<string, unknown>;
}): Promise<MeteringResult> {
  const amount = Math.max(0, params.amount ?? 1);
  if (amount === 0) {
    return { allowed: true, charged: false, skipped: true, reason: 'Zero successful outcomes — no usage recorded' };
  }

  const snapshot = await loadTenantSnapshot(params.tenantId);
  if (!snapshot) {
    return { allowed: false, charged: false, skipped: false, reason: 'Workspace not found' };
  }

  const entitlement = resolveEntitlementContext(snapshot);
  if (!shouldEnforceDailyQuota(entitlement)) {
    await recordUsageEvent({
      tenantId: params.tenantId,
      userId: params.userId,
      operationId: params.operationId,
      initiationSource: params.initiationSource,
      businessAction: 'mcp_business_success',
      success: true,
      quotaCharged: false,
      quotaReason: `${entitlement.accessMode}: quota not enforced`,
      metadata: { resource: params.resource, amount, ...params.metadata },
    });
    return { allowed: true, charged: false, skipped: true, unlimited: true };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('record_metered_usage_idempotent', {
    p_tenant_id: params.tenantId,
    p_user_id: params.userId,
    p_resource: params.resource,
    p_amount: amount,
    p_operation_id: params.operationId || null,
    p_initiation_source: params.initiationSource,
  });

  if (error) {
    console.error('[metering] recordSuccessfulUsage RPC error:', error);
    return { allowed: false, charged: false, skipped: false, reason: 'Failed to record usage' };
  }

  const alreadyRecorded = Boolean(data?.alreadyRecorded);
  const charged = Boolean(data?.charged);
  return {
    allowed: true,
    charged,
    skipped: alreadyRecorded,
    currentUsage: Number(data?.currentUsage || 0),
    limit: Number(data?.limit ?? -1),
    unlimited: Boolean(data?.unlimited),
    reason: alreadyRecorded ? 'Idempotent replay — usage unchanged' : undefined,
  };
}

export { loadTenantSnapshot, resolveEntitlementContext };
