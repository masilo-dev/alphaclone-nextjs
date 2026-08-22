import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendDailyOperationsDigest } from '@/lib/email/dailyBusinessDigestEngine';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const admin = createSupabaseAdminClient();
  const { data: tenants, error } = await admin
    .from('tenants')
    .select('id, name')
    .limit(500);

  if (error || !tenants) {
    return NextResponse.json({ error: error?.message || 'Failed to list tenants' }, { status: 500 });
  }

  let totalEmailsSent = 0;
  const results: Array<{ tenantId: string; emailsSent: number }> = [];

  for (const tenant of tenants) {
    try {
      const res = await sendDailyOperationsDigest(tenant.id);
      totalEmailsSent += res.emailsSent;
      results.push({ tenantId: tenant.id, emailsSent: res.emailsSent });
    } catch (err: any) {
      console.error(`[daily-business-digest] Error for tenant ${tenant.id}:`, err?.message || String(err));
    }
  }

  return NextResponse.json({
    status: 'ok',
    tenantsProcessed: tenants.length,
    totalEmailsSent,
    details: results,
  });
}
