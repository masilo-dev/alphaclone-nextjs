import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { buildChaseBrief } from '@/lib/chaser/chaseDetector';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId, req);
    const brief = await buildChaseBrief(tenantId);
    return NextResponse.json(brief);
  } catch (error) {
    return routeErrorResponse(error, 'Failed to build chase brief');
  }
}
