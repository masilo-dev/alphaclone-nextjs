import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { deriveMarketingWeekInsight } from '@/lib/marketing/marketingWeekInsight';

export const dynamic = 'force-dynamic';

/** GET /api/marketing/week-insight?tenantId= — evidence-based, no invented metrics */
export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    await requireTenantAccess(tenantId, req);
    const insight = await deriveMarketingWeekInsight(tenantId);
    return NextResponse.json({ success: true, insight });
  } catch (error) {
    return routeErrorResponse(error, 'Marketing insight unavailable', req);
  }
}
