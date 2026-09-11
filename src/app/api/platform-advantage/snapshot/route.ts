import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { fetchPlatformAdvantageSnapshot } from '@/lib/platform-advantage/fetchPlatformAdvantageSnapshot';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId);
    const snapshot = await fetchPlatformAdvantageSnapshot(tenantId, user.id);

    return NextResponse.json({ success: true, snapshot });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load platform advantage snapshot');
  }
}
