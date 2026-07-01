import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { getTenantAiUnitsStatus } from '@/lib/quotas/tenantAiUnitsQuota';
import { nextUtcMidnightIso, pricingUpgradeUrl } from '@/config/aiLeadQuotas';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);

    const admin = createSupabaseAdminClient();
    const { data: tenantRow } = await admin
      .from('tenants')
      .select('subscription_plan')
      .eq('id', tenantId)
      .maybeSingle();

    const plan = (tenantRow?.subscription_plan as string) || 'free';
    const status = await getTenantAiUnitsStatus(admin, tenantId, plan);

    if (!status.ok && status.used === 0 && status.remaining === 0) {
      return NextResponse.json({ error: 'Could not load AI quota' }, { status: 503 });
    }

    return NextResponse.json({
      plan,
      used: status.used,
      limit: status.limit,
      remaining: status.remaining,
      resetsAt: nextUtcMidnightIso(),
      upgradeUrl: pricingUpgradeUrl(),
      percentUsed: status.limit > 0 ? Math.min(100, Math.round((status.used / status.limit) * 100)) : 0,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Could not load Bonnie AI quota.', request);
  }
}
