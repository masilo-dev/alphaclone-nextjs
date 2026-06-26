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
    const stats = await dashboardStatsService.getProjectsStats(supabase, tenantId);

    return NextResponse.json({ stats });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load project stats');
  }
}
