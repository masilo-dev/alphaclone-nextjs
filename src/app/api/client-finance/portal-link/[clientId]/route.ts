import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { getOrCreateClientPortalUrl } from '@/services/finance/clientFinancePortalService';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await context.params;
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { admin } = await requireTenantAccess(tenantId, req);
    const url = await getOrCreateClientPortalUrl(admin, tenantId, clientId, req.nextUrl.origin);

    return NextResponse.json({ success: true, url });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to build client portal link', req);
  }
}
