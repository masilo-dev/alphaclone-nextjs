import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  createRunForObjective,
  listRuns,
  getRunProgressSummary,
  isDurableRuntimeEnabled,
} from '@/lib/bonnie/runtime';
import { getRuntimeMetrics } from '@/lib/bonnie/runtime/observability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    await requireTenantAccess(tenantId);

    const metrics = request.nextUrl.searchParams.get('metrics') === '1';
    if (metrics) {
      return NextResponse.json({
        success: true,
        durableEnabled: isDurableRuntimeEnabled(),
        metrics: await getRuntimeMetrics(tenantId),
      });
    }

    const runs = await listRuns({ tenantId, limit: 40 });
    return NextResponse.json({
      success: true,
      durableEnabled: isDurableRuntimeEnabled(),
      runs,
    });
  } catch (err: unknown) {
    return routeErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    const objective = String(body.objective || body.goal || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    if (!objective) return NextResponse.json({ error: 'objective is required' }, { status: 400 });

    const { user } = await requireTenantAccess(tenantId);
    const created = await createRunForObjective({
      tenantId,
      userId: user.id,
      conversationId: body.conversationId || null,
      objective,
      executionMode: body.executionMode,
      priority: body.priority,
      successCriteria: body.successCriteria,
      seedGraph: body.seedGraph !== false,
    });

    const progress = await getRunProgressSummary(created.run.id, tenantId);
    return NextResponse.json({
      success: true,
      run: created.run,
      goalId: created.goalId,
      graphId: created.graphId,
      progress,
    });
  } catch (err: unknown) {
    return routeErrorResponse(err);
  }
}
