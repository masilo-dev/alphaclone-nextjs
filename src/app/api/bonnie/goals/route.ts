import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  chaseOpenGoals,
  createGoalFromPlan,
  listGoals,
  runCognitiveLoop,
  selectAgentsForGoal,
  collectToolsFromAgents,
  estimateRiskLevel,
  decideSupervision,
} from '@/lib/bonnie/os';
import type { GoalStatus } from '@/lib/bonnie/os/goalEngine';

export const dynamic = 'force-dynamic';

/**
 * Bonnie persistent goals.
 * GET  ?tenantId=&status=open|all — list goals
 * POST { tenantId, action: 'create'|'chase', goal?, executeActions? }
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const statusParam = String(request.nextUrl.searchParams.get('status') || 'open').trim();
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || 40), 100);

    let status: 'open' | GoalStatus[] | undefined =
      statusParam === 'open' ? 'open' : undefined;
    if (statusParam !== 'open' && statusParam !== 'all') {
      status = [statusParam as GoalStatus];
    }

    const goals = await listGoals({
      tenantId,
      status,
      limit,
    });

    return NextResponse.json({
      success: true,
      goals,
      count: goals.length,
    });
  } catch (err: unknown) {
    return routeErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    const action = String(body.action || 'create').trim();

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId);
    const supabase = await createSupabaseServerClient();
    const { data: authUser } = await supabase.auth.getUser();
    const userId = authUser.user?.id || user.id;

    if (action === 'chase') {
      const result = await chaseOpenGoals({
        tenantId,
        userId,
        limit: Math.min(Number(body.limit) || 5, 20),
        runCognitive: async (goal) =>
          runCognitiveLoop({
            tenantId,
            userId,
            goal: goal.description || goal.title,
            triggerType: 'continuous',
            goalId: goal.id,
            conversationId: goal.conversation_id || undefined,
            workflowId: goal.workflow_id || undefined,
            executeActions: body.executeActions !== false,
          }),
      });
      return NextResponse.json({ success: true, ...result });
    }

    const goalText = String(body.goal || body.title || '').trim();
    if (!goalText) {
      return NextResponse.json({ error: 'goal is required' }, { status: 400 });
    }

    // Prefer full cognitive loop so goals get real plans + subtasks
    if (body.runCognitive !== false) {
      const cognitive = await runCognitiveLoop({
        tenantId,
        userId,
        goal: goalText,
        triggerType: 'instruction',
        conversationId: body.conversationId || undefined,
        executeActions: body.executeActions === true,
      });
      return NextResponse.json({
        success: cognitive.status !== 'failed',
        goalId: cognitive.goalId,
        status: cognitive.status,
        confidence: cognitive.confidence,
        selectedAgents: cognitive.selectedAgents.map((a) => ({
          id: a.id,
          name: a.name,
          department: a.department,
        })),
        stages: cognitive.stages,
        supervisor: cognitive.supervisor,
      });
    }

    const agents = selectAgentsForGoal(goalText, { maxAgents: 4 });
    const tools = collectToolsFromAgents(agents);
    const risk = estimateRiskLevel(goalText, tools);
    const supervisor = decideSupervision({
      goal: goalText,
      selectedAgents: agents,
      selectedTools: tools,
    });

    const created = await createGoalFromPlan({
      tenantId,
      userId,
      goal: goalText,
      agents,
      tools,
      riskLevel: risk,
      requiresApproval: supervisor.requiresApproval,
      triggerType: 'instruction',
      conversationId: body.conversationId || null,
      metadata: { source: 'goals_api' },
    });

    return NextResponse.json({
      success: Boolean(created),
      goal: created,
      supervisor,
    });
  } catch (err: unknown) {
    return routeErrorResponse(err);
  }
}
