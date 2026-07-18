import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { RouteAuthError } from '@/lib/api/routeAuthError';

export type DailyResource = 'leads' | 'contracts' | 'invoices' | 'receipts';

export async function consumeDailyResourceQuota(tenantId: string, userId: string, resource: DailyResource, amount = 1) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('consume_daily_resource_quota', { p_tenant_id: tenantId, p_user_id: userId, p_resource: resource, p_amount: amount });
  if (error) throw error;
  const result = data as { allowed?: boolean; currentUsage?: number; limit?: number; remaining?: number } | null;
  if (!result?.allowed) {
    throw new RouteAuthError(429, `Daily ${resource} limit reached (${result?.currentUsage || 0}/${result?.limit || 0}).`, 'QUOTA_EXCEEDED');
  }
}

export async function releaseDailyResourceQuota(tenantId: string, userId: string, resource: DailyResource, amount = 1) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc('release_daily_resource_quota', { p_tenant_id: tenantId, p_user_id: userId, p_resource: resource, p_amount: amount });
  if (error) console.error('[quota] reservation release failed', { tenantId, userId, resource, amount, error });
}
