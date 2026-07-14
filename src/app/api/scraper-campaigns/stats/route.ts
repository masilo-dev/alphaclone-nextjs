import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { getLeadFinderStats } from '@/lib/scraper/leadFinderStatsServer';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const stats = await getLeadFinderStats(tenantId);
    return NextResponse.json({ stats });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load lead finder stats');
  }
}
