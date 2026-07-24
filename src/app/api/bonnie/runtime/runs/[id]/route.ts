import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  getRun,
  getRunProgressSummary,
  requestRunCancellation,
  getGraphForRun,
} from '@/lib/bonnie/runtime';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { listInterventions } from '@/lib/bonnie/runtime/interventionService';
import { decideApproval } from '@/lib/bonnie/runtime/approvalDurabilityService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(context.params);
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    await requireTenantAccess(tenantId);

    const run = await getRun(id, tenantId);
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    const [progress, graph, interventions] = await Promise.all([
      getRunProgressSummary(id, tenantId),
      getGraphForRun(id, tenantId),
      listInterventions(tenantId, 'open'),
    ]);

    const admin = createSupabaseAdminClient();
    const taskIds = (graph?.tasks || []).map((t: { id: string }) => t.id);
    let timeline: unknown[] = [];
    if (taskIds.length) {
      const { data } = await admin
        .from('agent_state_transitions')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('entity_id', taskIds)
        .order('created_at', { ascending: false })
        .limit(100);
      timeline = data || [];
    }

    return NextResponse.json({
      success: true,
      run,
      progress,
      graph,
      interventions: interventions.filter((i) => i.run_id === id),
      timeline,
    });
  } catch (err: unknown) {
    return routeErrorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(context.params);
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    const { user } = await requireTenantAccess(tenantId);

    if (body.cancel === true) {
      await requestRunCancellation(id, tenantId, body.reason);
      return NextResponse.json({ success: true, cancelled: true });
    }

    if (body.approvalId && body.decision) {
      const result = await decideApproval({
        tenantId,
        approvalId: body.approvalId,
        decision: body.decision,
        decisionMaker: user.id,
        reason: body.reason,
        currentDataVersion: body.currentDataVersion,
      });
      return NextResponse.json({ success: result.ok, ...result });
    }

    return NextResponse.json({ error: 'No action specified' }, { status: 400 });
  } catch (err: unknown) {
    return routeErrorResponse(err);
  }
}
