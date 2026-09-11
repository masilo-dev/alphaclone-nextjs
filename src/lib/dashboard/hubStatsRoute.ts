import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getHubKpiStats } from '@/lib/dashboard/hubKpiService';
import type { HubKpiId } from '@/lib/dashboard/hubKpi';

const CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
};

export async function respondWithHubStats(
  request: NextRequest,
  hub: HubKpiId,
  errorMessage: string,
) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();
    const stats = await getHubKpiStats(supabase, tenantId, hub);

    return NextResponse.json({ stats }, { headers: CACHE_HEADERS });
  } catch (error) {
    return routeErrorResponse(error, errorMessage);
  }
}
