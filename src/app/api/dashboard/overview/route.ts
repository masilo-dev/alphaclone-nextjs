import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { dashboardStatsService } from '@/services/dashboardStatsService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();
    const stats = await dashboardStatsService.getOverviewStats(supabase, tenantId);

    return NextResponse.json({ stats }, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load overview stats');
  }
}
