import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { emitBusinessEvent } from '@/lib/automation/emit-event';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = String(body.tenantId || '').trim();
    const eventType = String(body.eventType || '').trim();
    const payload = (body.payload && typeof body.payload === 'object') ? body.payload : {};

    if (!tenantId || !eventType) {
      return NextResponse.json({ error: 'tenantId and eventType are required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    await emitBusinessEvent(tenantId, eventType, payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to emit automation event', req);
  }
}
