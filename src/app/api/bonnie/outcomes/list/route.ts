import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { listSupportedOutcomesForDiscovery } from '@/lib/mcp/intentAdapter';

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '');
    await requireTenantAccess(tenantId, request);
    return NextResponse.json({
      success: true,
      outcomes: listSupportedOutcomesForDiscovery(),
      request_tool: 'request_outcome',
      poll_tool: 'get_outcome_status',
    });
  } catch (error) {
    return routeErrorResponse(error, 'Supported outcomes could not be loaded', request);
  }
}
