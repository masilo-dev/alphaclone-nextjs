import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { buildExecutionAssuranceReport } from '@/lib/mcp/executionAssurance';

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '');
    const days = Math.max(1, Math.min(90, Number(request.nextUrl.searchParams.get('days') || 30)));
    await requireTenantAccess(tenantId, request);
    const report = await buildExecutionAssuranceReport({ tenantId, sinceDays: days });
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    return routeErrorResponse(error, 'Execution assurance report could not be loaded', request);
  }
}
