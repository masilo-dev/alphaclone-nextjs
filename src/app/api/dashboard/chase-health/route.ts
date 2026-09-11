import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { getChaseHealthMetrics } from '@/lib/chaser/chaseMetricsService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId, req);
    const metrics = await getChaseHealthMetrics(tenantId);
    return NextResponse.json(metrics);
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load chase health');
  }
}
