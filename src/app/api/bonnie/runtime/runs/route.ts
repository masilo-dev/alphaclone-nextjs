import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  createRunForObjective,
  listRuns,
  getRunProgressSummary,
  isDurableRuntimeEnabled,
  createRunRequestSchema,
  startInvoiceCollectionRun,
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
    const parsed = createRunRequestSchema.safeParse({
      tenantId: body.tenantId,
      objective: body.objective || body.goal,
      conversationId: body.conversationId ?? null,
      executionMode: body.executionMode,
      priority: body.priority,
      successCriteria: body.successCriteria,
      seedGraph: body.seedGraph,
      workflowTemplate: body.workflowTemplate || body.template,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid run request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { user } = await requireTenantAccess(parsed.data.tenantId);

    if (parsed.data.workflowTemplate === 'invoice_collection') {
      const created = await startInvoiceCollectionRun({
        tenantId: parsed.data.tenantId,
        userId: user.id,
        conversationId: parsed.data.conversationId,
        objective: parsed.data.objective,
        invoiceIds: Array.isArray(body.invoiceIds) ? body.invoiceIds : undefined,
        limit: typeof body.limit === 'number' ? body.limit : undefined,
      });
      const progress = await getRunProgressSummary(created.run.id, parsed.data.tenantId);
      return NextResponse.json({
        success: true,
        template: 'invoice_collection',
        run: created.run,
        goalId: created.goalId,
        graphId: created.graphId,
        invoiceCount: created.invoiceCount,
        policy: created.policy,
        progress,
      });
    }

    const created = await createRunForObjective({
      tenantId: parsed.data.tenantId,
      userId: user.id,
      conversationId: parsed.data.conversationId,
      objective: parsed.data.objective,
      executionMode: parsed.data.executionMode,
      priority: parsed.data.priority,
      successCriteria: parsed.data.successCriteria,
      seedGraph: parsed.data.seedGraph !== false,
    });

    const progress = await getRunProgressSummary(created.run.id, parsed.data.tenantId);
    return NextResponse.json({
      success: true,
      template: 'generic',
      run: created.run,
      goalId: created.goalId,
      graphId: created.graphId,
      progress,
    });
  } catch (err: unknown) {
    return routeErrorResponse(err);
  }
}
