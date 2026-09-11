import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { RouteAuthError } from '@/lib/api/routeAuthError';
import {
  recordSuccessfulUsage,
  validateProjectedUsage,
} from '@/lib/entitlements/meteringService';
import type { QuotaResourceType } from '@/lib/entitlements/planEntitlements';

export type DailyResource = QuotaResourceType;

/** Validate projected usage without incrementing counters. */
export async function validateDailyResourceQuota(
  tenantId: string,
  userId: string,
  resource: DailyResource,
  amount = 1,
) {
  const result = await validateProjectedUsage(tenantId, userId, resource, amount);
  if (!result.allowed) {
    throw new RouteAuthError(
      429,
      result.reason || `Daily ${resource} limit would be exceeded.`,
      'QUOTA_EXCEEDED',
    );
  }
}

/** Record usage after a successful, persisted business action. */
export async function recordDailyResourceQuota(
  tenantId: string,
  userId: string,
  resource: DailyResource,
  amount = 1,
  operationId?: string,
) {
  const result = await recordSuccessfulUsage({
    tenantId,
    userId,
    resource,
    amount,
    operationId,
    initiationSource: 'api',
  });
  if (!result.allowed) {
    throw new RouteAuthError(500, result.reason || 'Failed to record usage', 'METERING_ERROR');
  }
  return result;
}

/**
 * @deprecated Pre-charging violates validate→execute→record semantics.
 * Use validateDailyResourceQuota before execution and recordDailyResourceQuota after success.
 */
export async function consumeDailyResourceQuota(
  tenantId: string,
  userId: string,
  resource: DailyResource,
  amount = 1,
) {
  return validateDailyResourceQuota(tenantId, userId, resource, amount);
}

/** @deprecated No pre-charges to release when using validate→record flow. */
export async function releaseDailyResourceQuota(
  tenantId: string,
  userId: string,
  resource: DailyResource,
  amount = 1,
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc('release_daily_resource_quota', {
    p_tenant_id: tenantId,
    p_user_id: userId,
    p_resource: resource,
    p_amount: amount,
  });
  if (error) console.error('[quota] legacy release call (no-op expected):', { tenantId, resource, amount, error });
}
