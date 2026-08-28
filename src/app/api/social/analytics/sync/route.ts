import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { syncSocialPostAnalyticsForTenant } from '@/lib/social/syncSocialPostAnalytics';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { admin, user } = await requireTenantAccess(tenantId, request);
    const days = Number(body.days) || 90;
    const limit = Number(body.limit) || 40;

    const result = await syncSocialPostAnalyticsForTenant(admin, tenantId, {
      days,
      limit,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      synced: result.synced,
      failed: result.failed,
      results: result.results,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to sync social analytics', request);
  }
}
