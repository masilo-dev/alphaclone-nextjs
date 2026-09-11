import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ZohoService } from '@/services/zoho/ZohoService';

export const dynamic = 'force-dynamic';

/**
 * Validates Zoho refresh tokens still work; marks integrations with authExpiredAt when refresh fails.
 */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from('integrations')
    .select('user_id, tenant_id, config, enabled')
    .eq('type', 'zoho')
    .eq('enabled', true)
    .order('updated_at', { ascending: false })
    .limit(100);

  let checked = 0;
  let expired = 0;
  let healthy = 0;

  for (const row of rows || []) {
    if (!row.user_id || !row.tenant_id) continue;
    checked++;
    try {
      const zoho = new ZohoService(String(row.user_id), String(row.tenant_id));
      const config = await zoho.getConfig();
      if (!config?.refreshToken) {
        expired++;
        continue;
      }
      await zoho.getValidAccessToken();
      healthy++;
    } catch {
      expired++;
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    checked,
    healthy,
    expired,
  });
}
