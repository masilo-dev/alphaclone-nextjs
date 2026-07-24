import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { requireTenantAccess } from '@/lib/apiAuth';
import {
  DEPARTMENT_AGENTS,
  getKnowledgeGraphSummary,
  getLatestDigitalTwin,
  listAgentRuntimeStatuses,
  listGoals,
  listRegisteredAgents,
  runCognitiveLoop,
} from '@/lib/bonnie/os';

export const dynamic = 'force-dynamic';

/**
 * Bonnie Agentic OS status + optional cognitive run.
 * GET  ?tenantId= — OS status (agents, twin, knowledge graph, open goals)
 * POST { tenantId, goal, executeActions? } — run cognitive loop
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const [twin, graph, openGoals] = await Promise.all([
      getLatestDigitalTwin(tenantId),
      getKnowledgeGraphSummary(tenantId, 20),
      listGoals({ tenantId, status: 'open', limit: 12 }),
    ]);

    return NextResponse.json({
      success: true,
      os: 'Bonnie Agentic Business Operating System',
      agents: listAgentRuntimeStatuses(),
      agentRoster: listRegisteredAgents().map((a) => ({
        id: a.id,
        name: a.name,
        department: a.department,
        role: a.role,
        capabilities: a.capabilities,
        supportedModes: a.supportedModes,
        confidencePrior: a.confidencePrior,
        healthStatus: a.healthStatus,
      })),
      departmentCount: new Set(DEPARTMENT_AGENTS.map((a) => a.department)).size,
      openGoals: openGoals.map((g) => ({
        id: g.id,
        title: g.title,
        status: g.status,
        progressPct: g.progress_pct,
        waitingFor: g.waiting_for,
        ownerAgentId: g.owner_agent_id,
        executionMode: g.execution_mode,
        updatedAt: g.updated_at,
      })),
      twin,
      knowledgeGraph: {
        nodeCount: (graph.nodes || []).length,
        edgeCount: (graph.edges || []).length,
        sampleNodes: graph.nodes,
        sampleEdges: graph.edges,
      },
      loop: [
        'observe', 'understand', 'reason', 'plan', 'simulate', 'evaluate_risk',
        'choose_strategy', 'choose_agents', 'choose_tools', 'execute', 'verify',
        'reflect', 'learn', 'update_memory', 'improve', 'continue_monitoring',
      ],
      executionModes: [
        'ask_only',
        'plan_only',
        'approval_required',
        'semi_autonomous',
        'fully_autonomous',
      ],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /unauthorized|forbidden|access/i.test(message) ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    const goal = String(body.goal || body.instruction || '').trim();
    const executeActions = body.executeActions !== false;

    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    if (!goal) return NextResponse.json({ error: 'goal is required' }, { status: 400 });

    const { user } = await requireTenantAccess(tenantId);
    const supabase = await createSupabaseServerClient();
    const { data: authUser } = await supabase.auth.getUser();
    const userId = authUser.user?.id || user.id;

    const result = await runCognitiveLoop({
      tenantId,
      userId,
      goal,
      triggerType: 'instruction',
      executeActions,
    });

    return NextResponse.json({
      success: result.status !== 'failed',
      runId: result.runId,
      goalId: result.goalId,
      status: result.status,
      confidence: result.confidence,
      strategy: result.strategy,
      risk: result.riskAssessment,
      selectedAgents: result.selectedAgents.map((a) => ({ id: a.id, name: a.name, department: a.department })),
      selectedTools: result.selectedTools,
      stages: result.stages,
      reflectionId: result.reflectionId,
      twinSnapshotId: result.twinSnapshotId,
      outcome: result.outcome,
      supervisor: result.supervisor,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /unauthorized|forbidden|access/i.test(message) ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
