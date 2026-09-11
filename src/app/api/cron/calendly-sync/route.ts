import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { pullAndSyncCalendlyEvents, type CalendlyTenantConfig } from '@/lib/calendly/syncToNative';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const admin = createSupabaseAdminClient();
  const { data: tenants } = await admin
    .from('tenants')
    .select('id, settings');

  const results: Array<{ tenantId: string; synced: number; error?: string }> = [];

  for (const tenant of tenants || []) {
    const cal = tenant.settings?.calendly as CalendlyTenantConfig | undefined;
    if (!cal?.accessToken || !cal.calendlyUserUri) continue;

    const { data: owner } = await admin
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', tenant.id)
      .limit(1)
      .maybeSingle();

    if (!owner?.user_id) {
      results.push({ tenantId: tenant.id, synced: 0, error: 'no_owner' });
      continue;
    }

    try {
      const { syncedCount } = await pullAndSyncCalendlyEvents(tenant.id, owner.user_id, cal);
      results.push({ tenantId: tenant.id, synced: syncedCount });
    } catch (err) {
      results.push({
        tenantId: tenant.id,
        synced: 0,
        error: err instanceof Error ? err.message : 'sync_failed',
      });
    }
  }

  return NextResponse.json({ success: true, results });
}
