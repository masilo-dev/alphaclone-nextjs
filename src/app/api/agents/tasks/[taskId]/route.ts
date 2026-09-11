import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });

    const { taskId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId, request);
    const { data, error } = await admin
      .from('agent_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', taskId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Agent task not found' }, { status: 404 });

    return NextResponse.json({ success: true, task: data });
  } catch (error) {
    return routeErrorResponse(error, 'Agent task could not be loaded', request);
  }
}
