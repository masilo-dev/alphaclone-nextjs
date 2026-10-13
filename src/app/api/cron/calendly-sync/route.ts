import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { pullAndSyncCalendlyEvents, resolveTenantHostUser, type CalendlyTenantConfig } from '@/lib/calendly/syncToNative';
import { withCronJob } from '@/lib/cron/withCronJob';
import { refreshCalendlyTokenIfNeeded } from '@/services/calendly/calendlyIntegrationService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  return withCronJob('calendly-sync', async () => {
    const admin = createSupabaseAdminClient();
    const { data: tenants, error } = await admin
      .from('tenants')
      .select('id, settings').filter('settings->calendly->>enabled', 'eq', 'true');
    if (error) throw error;

    const results: Array<{ tenantId: string; synced: number; error?: string }> = [];

    for (const tenant of tenants || []) {
      try {
        const cal = await refreshCalendlyTokenIfNeeded(admin, tenant.id) as CalendlyTenantConfig | null;
        if (!cal?.accessToken || !cal.calendlyUserUri) continue;
        const hostUserId = await resolveTenantHostUser(tenant.id);
        if (!hostUserId) throw new Error('No tenant host available');
        const { syncedCount } = await pullAndSyncCalendlyEvents(tenant.id, hostUserId, cal);
        results.push({ tenantId: tenant.id, synced: syncedCount });
      } catch (err) {
        results.push({
          tenantId: tenant.id,
          synced: 0,
          error: err instanceof Error ? err.message : 'sync_failed',
        });
      }
    }

    return NextResponse.json({ success: !results.some(result => result.error), results });
  }, { lockTtlSec: 300, maxDurationMs: 240_000 });
}
