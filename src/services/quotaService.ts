import { supabase } from '../lib/supabase';
import { createSupabaseAdminClient } from '../lib/supabase-admin';
import { tenantService } from './tenancy/TenantService';
import {
  evaluateEntitlement,
  formatQuotaExceededMessage,
  isUnlimitedPlan,
  normalizePlanId,
  resolveResourceLimits,
  type NormalizedPlanId,
  type QuotaResourceType,
} from '@/lib/entitlements/planEntitlements';
import {
  resolveEntitlementContext,
  type TenantEntitlementSnapshot,
} from '@/lib/entitlements/entitlementContext';
import { ACTION_CATEGORY_LABELS } from '@/lib/entitlements/actionCategoryLabels';

export type { QuotaResourceType } from '@/lib/entitlements/planEntitlements';

export interface QuotaCheckResult {
  allowed: boolean;
  currentUsage: number;
  /** -1 = unlimited (Premium). Never a fake large number. */
  limit: number;
  remaining: number;
  unlimited?: boolean;
  plan?: string;
  normalizedPlan?: NormalizedPlanId;
  message: string;
}

export interface DetailedUsageSummary {
  date: string;
  plan: string;
  normalizedPlan: NormalizedPlanId;
  unlimited: boolean;
  metrics: Record<QuotaResourceType, { current: number; limit: number; remaining: number; unlimited: boolean }>;
}

/** @deprecated Use resolveResourceLimits from planEntitlements */
export const PLAN_RESOURCE_LIMITS = {
  free: resolveResourceLimits('free'),
  pro: resolveResourceLimits('pro'),
  starter: resolveResourceLimits('pro'),
  premium: resolveResourceLimits('premium'),
  enterprise: resolveResourceLimits('premium'),
  custom: resolveResourceLimits('premium'),
};

function resourceLabel(resource: QuotaResourceType): string {
  return ACTION_CATEGORY_LABELS[resource]?.label || resource.replace(/_/g, ' ');
}

export const quotaService = {
  getTenantId(): string | null {
    return tenantService.getCurrentTenantId();
  },

  async consumeQuotaAtomically(
    tenantId: string,
    userId: string,
    resource: QuotaResourceType,
    amount = 1,
    client: any = null
  ): Promise<QuotaCheckResult> {
    try {
      const dbClient = client || createSupabaseAdminClient();
      const { data, error } = await dbClient.rpc('consume_daily_resource_quota', {
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_resource: resource,
        p_amount: amount,
      });

      if (error) {
        console.error(`Atomic quota RPC error for ${resource}:`, error);
        return {
          allowed: false,
          currentUsage: 0,
          limit: 0,
          remaining: 0,
          message: 'Unable to verify usage allowance — action blocked for safety',
        };
      }

      const allowed = Boolean(data?.allowed);
      const currentUsage = Number(data?.currentUsage || 0);
      const limit = Number(data?.limit ?? -1);
      const remaining = Number(data?.remaining ?? -1);
      const rawPlan = String(data?.plan || 'free');
      const unlimited = limit < 0 || isUnlimitedPlan(rawPlan);
      const normalizedPlan = normalizePlanId(rawPlan);
      const label = resourceLabel(resource);

      return {
        allowed: unlimited ? true : allowed,
        currentUsage,
        limit,
        remaining,
        unlimited,
        plan: rawPlan,
        normalizedPlan,
        message: unlimited
          ? 'Unlimited plan — action permitted.'
          : allowed
            ? `Quota approved (${label}: ${currentUsage}/${limit})`
            : formatQuotaExceededMessage({
                plan: normalizedPlan,
                resourceLabel: label,
                currentUsage,
                limit,
              }),
      };
    } catch (err: any) {
      console.error(`Unexpected error in consumeQuotaAtomically:`, err);
      return {
        allowed: false,
        currentUsage: 0,
        limit: 0,
        remaining: 0,
        message: 'System error during quota consumption',
      };
    }
  },

  async releaseQuotaAtomically(
    tenantId: string,
    userId: string,
    resource: QuotaResourceType,
    amount = 1,
    client: any = null
  ): Promise<void> {
    try {
      const dbClient = client || createSupabaseAdminClient();
      await dbClient.rpc('release_daily_resource_quota', {
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_resource: resource,
        p_amount: amount,
      });
    } catch (err) {
      console.error('Failed to release quota atomically:', err);
    }
  },

  async getTenantUsageSummary(tenantId: string, userId: string): Promise<DetailedUsageSummary> {
    const admin = createSupabaseAdminClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: tenant } = await admin
      .from('tenants')
      .select('subscription_plan, subscription_status, trial_ends_at, trial_started_at, legacy_access_until, created_at, stripe_subscription_id')
      .eq('id', tenantId)
      .single();

    const rawPlan = (tenant?.subscription_plan || 'free').toLowerCase();
    const normalizedPlan = normalizePlanId(rawPlan);
    const entitlement = resolveEntitlementContext({
      tenantId,
      rawPlan,
      normalizedPlan,
      subscriptionStatus: String(tenant?.subscription_status || 'free'),
      createdAt: tenant?.created_at ? new Date(tenant.created_at) : null,
      trialStartedAt: tenant?.trial_started_at ? new Date(tenant.trial_started_at) : null,
      trialEndsAt: tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null,
      legacyAccessUntil: tenant?.legacy_access_until ? new Date(tenant.legacy_access_until) : null,
      stripeSubscriptionId: tenant?.stripe_subscription_id || null,
    } satisfies TenantEntitlementSnapshot);
    const unlimited = entitlement.unlimited;
    const defaults = resolveResourceLimits(unlimited ? 'premium' : rawPlan);

    const { data: usage } = await admin
      .from('quota_usage')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    const metrics = {} as DetailedUsageSummary['metrics'];
    const keys = Object.keys(defaults) as QuotaResourceType[];

    for (const key of keys) {
      const current = Number(usage?.[key] || 0);
      const limit = defaults[key] ?? -1;
      const metricUnlimited = unlimited || limit < 0;
      const remaining = metricUnlimited ? -1 : Math.max(0, limit - current);
      metrics[key] = { current, limit, remaining, unlimited: metricUnlimited };
    }

    return {
      date: today,
      plan: rawPlan,
      normalizedPlan,
      unlimited,
      metrics,
    };
  },

  evaluateEntitlement,
};
