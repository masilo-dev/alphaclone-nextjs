import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { listChaseInstances } from '@/lib/chaser/chaseInstanceService';
import { ACTIVE_CHASE_STATES } from '@/lib/chaser/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId, req);

    const stateParam = req.nextUrl.searchParams.get('state');
    const { data, error } = await listChaseInstances(tenantId, {
      state: stateParam ? (stateParam as any) : (Array.from(ACTIVE_CHASE_STATES) as any),
      limit: Number(req.nextUrl.searchParams.get('limit') || 100),
    });

    if (error) {
      return NextResponse.json({ error }, { status: 503 });
    }

    return NextResponse.json({ items: data, count: data.length });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load chase inbox');
  }
}
