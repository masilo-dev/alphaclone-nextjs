import { supabase } from '../lib/supabase';
import { createSupabaseAdminClient } from '../lib/supabase-admin';
import { tenantService } from './tenancy/TenantService';

export type QuotaResourceType =
  | 'leads'
  | 'outreach_actions'
  | 'linkedin_posts'
  | 'facebook_posts'
  | 'instagram_posts'
  | 'email_actions'
  | 'mcp_executions'
  | 'contracts'
  | 'invoices'
  | 'receipts';

export interface QuotaCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number; // -1 for unlimited
  remaining: number;
  plan?: string;
  message: string;
}

export interface DetailedUsageSummary {
  date: string;
  plan: string;
  metrics: Record<QuotaResourceType, { current: number; limit: number; remaining: number }>;
}

export const PLAN_RESOURCE_LIMITS: Record<string, Record<QuotaResourceType, number>> = {
  free: {
    leads: 50,
    outreach_actions: 20,
    linkedin_posts: 1,
    facebook_posts: 1,
    instagram_posts: 1,
    email_actions: 25,
    mcp_executions: 50,
    contracts: 4,
    invoices: 30,
    receipts: 30,
  },
  starter: {
    leads: 100,
    outreach_actions: 100,
    linkedin_posts: 3,
    facebook_posts: 3,
    instagram_posts: 3,
    email_actions: 150,
    mcp_executions: 250,
    contracts: 15,
    invoices: 100,
    receipts: 100,
  },
  pro: {
    leads: 500,
    outreach_actions: 500,
    linkedin_posts: 10,
    facebook_posts: 10,
    instagram_posts: 10,
    email_actions: 750,
    mcp_executions: 1500,
    contracts: 50,
    invoices: 500,
    receipts: 500,
  },
  enterprise: {
    leads: -1,
    outreach_actions: -1,
    linkedin_posts: -1,
    facebook_posts: -1,
    instagram_posts: -1,
    email_actions: -1,
    mcp_executions: -1,
    contracts: -1,
    invoices: -1,
    receipts: -1,
  },
};

export const quotaService = {
  getTenantId(): string | null {
    return tenantService.getCurrentTenantId();
  },

  /**
   * Consume quota atomically using Postgres RPC function
   */
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
        // Fallback gracefully to prevent hard crashes if RPC permission fails
        return {
          allowed: true,
          currentUsage: 0,
          limit: -1,
          remaining: -1,
          message: 'Quota check bypassed due to internal error',
        };
      }

      const allowed = Boolean(data?.allowed);
      const currentUsage = Number(data?.currentUsage || 0);
      const limit = Number(data?.limit ?? -1);
      const remaining = Number(data?.remaining ?? -1);
      const plan = data?.plan || 'free';

      return {
        allowed,
        currentUsage,
        limit,
        remaining,
        plan,
        message: allowed
          ? `Quota approved (${resource}: ${currentUsage}/${limit < 0 ? 'unlimited' : limit})`
          : `Daily limit reached for ${resource} on ${plan.toUpperCase()} plan (${currentUsage}/${limit}). Upgrade plan to execute more.`,
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

  /**
   * Release quota (revert consumption) if action failed
   */
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

  /**
   * Get complete usage breakdown for the active tenant
   */
  async getTenantUsageSummary(tenantId: string, userId: string): Promise<DetailedUsageSummary> {
    const admin = createSupabaseAdminClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: tenant } = await admin
      .from('tenants')
      .select('subscription_plan')
      .eq('id', tenantId)
      .single();

    const plan = (tenant?.subscription_plan || 'free').toLowerCase();
    const defaults = PLAN_RESOURCE_LIMITS[plan] || PLAN_RESOURCE_LIMITS.free;

    const { data: usage } = await admin
      .from('quota_usage')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    const metrics = {} as DetailedUsageSummary['metrics'];
    const keys: QuotaResourceType[] = [
      'leads',
      'outreach_actions',
      'linkedin_posts',
      'facebook_posts',
      'instagram_posts',
      'email_actions',
      'mcp_executions',
      'contracts',
      'invoices',
      'receipts',
    ];

    for (const key of keys) {
      const current = Number(usage?.[key] || 0);
      const limit = defaults[key] ?? -1;
      const remaining = limit < 0 ? -1 : Math.max(0, limit - current);
      metrics[key] = { current, limit, remaining };
    }

    return {
      date: today,
      plan,
      metrics,
    };
  },
};