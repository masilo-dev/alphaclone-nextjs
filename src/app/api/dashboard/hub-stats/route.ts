import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getHubKpiStats } from '@/lib/dashboard/hubKpiService';
import type { HubKpiId } from '@/lib/dashboard/hubKpi';

const VALID_HUBS = new Set<HubKpiId>([
  'overview',
  'crm',
  'outreach',
  'invoicing',
  'contracts',
  'projects',
  'social',
]);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    const hub = request.nextUrl.searchParams.get('hub') as HubKpiId | null;

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }
    if (!hub || !VALID_HUBS.has(hub)) {
      return NextResponse.json({ error: 'Invalid hub' }, { status: 400 });
    }

    const { admin: supabase } = await requireTenantAccess(tenantId);
    const stats = await getHubKpiStats(supabase, tenantId, hub);

    return NextResponse.json(
      { stats },
      {
        headers: {
          'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load hub stats');
  }
}
