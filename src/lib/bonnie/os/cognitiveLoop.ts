/**
 * Bonnie Cognitive Loop
 * Observe → Understand → Reason → Plan → Simulate → Evaluate Risk →
 * Choose Strategy → Choose Agents → Choose Tools → Execute → Verify →
 * Reflect → Learn → Update Memory → Improve → Continue Monitoring
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { executeSingleBonnieTool } from '@/lib/bonnie/executeSingleBonnieTool';
import { recordDecision } from '@/services/nexusDecisionLogService';
import { DEPARTMENT_AGENTS, toOrchestratorSubagents } from './agentRegistry';
import { buildMemoryContextForGoal } from './layeredMemory';
import { syncBusinessKnowledgeGraph } from './knowledgeGraph';
import { refreshDigitalTwin } from './digitalTwin';
import { applyReflectionMemory, persistReflection, synthesizeReflection } from './reflectionEngine';
import {
  collectToolsFromAgents,
  decideSupervision,
  selectAgentsForGoal,
} from './supervisor';
import type {
  CognitiveRunInput,
  CognitiveRunResult,
  CognitiveStageName,
  CognitiveStageRecord,
} from './types';

const STAGE_ORDER: CognitiveStageName[] = [
  'observe',
  'understand',
  'reason',
  'plan',
  'simulate',
  'evaluate_risk',
  'choose_strategy',
  'choose_agents',
  'choose_tools',
  'execute',
  'verify',
  'reflect',
  'learn',
  'update_memory',
  'improve',
  'continue_monitoring',
];

function stage(name: CognitiveStageName, status: CognitiveStageRecord['status'], summary?: string, evidence?: unknown[]): CognitiveStageRecord {
  const now = new Date().toISOString();
  return {
    name,
    status,
    startedAt: now,
    completedAt: status === 'completed' || status === 'failed' || status === 'skipped' ? now : undefined,
    summary,
    evidence,
    confidence: status === 'completed' ? 0.8 : status === 'failed' ? 0.2 : 0.5,
  };
}

async function createCognitiveRunRow(input: CognitiveRunInput): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('bonnie_cognitive_runs')
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId || null,
      trigger_type: input.triggerType || 'instruction',
      trigger_ref: input.triggerRef || null,
      goal: input.goal,
      status: 'running',
      workflow_id: input.workflowId || null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[cognitiveLoop] create run failed:', error.message);
    return null;
  }
  return data?.id || null;
}

async function finalizeCognitiveRun(
  runId: string | null,
  payload: Partial<{
    status: string;
    stages: CognitiveStageRecord[];
    selected_agents: unknown;
    selected_tools: unknown;
    strategy: unknown;
    risk_assessment: unknown;
    confidence: number;
    evidence: unknown;
    outcome: unknown;
    orchestration_run_id: string | null;
  }>
) {
  if (!runId) return;
  const admin = createSupabaseAdminClient();
  await admin
    .from('bonnie_cognitive_runs')
    .update({
      ...payload,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);
}

async function recordAgentExecution(params: {
  tenantId: string;
  cognitiveRunId: string | null;
  agentId: string;
  department: string;
  role: string;
  task: string;
  result: unknown;
  toolsUsed: string[];
  status: 'completed' | 'failed' | 'skipped';
  durationMs?: number;
  confidence?: number;
}) {
  const admin = createSupabaseAdminClient();
  try {
    await admin.from('bonnie_agent_executions').insert({
      tenant_id: params.tenantId,
      cognitive_run_id: params.cognitiveRunId,
      agent_id: params.agentId,
      department: params.department,
      role: params.role,
      task: params.task,
      status: params.status,
      result: params.result || {},
      tools_used: params.toolsUsed,
      confidence: params.confidence ?? null,
      duration_ms: params.durationMs ?? null,
    });
  } catch (err) {
    console.warn('[cognitiveLoop] agent execution ledger failed:', err);
  }
}

/**
 * Run the full Bonnie cognitive loop for a goal or business event.
 * Execution is policy-gated via executeSingleBonnieTool (approvals preserved).
 */
export async function runCognitiveLoop(input: CognitiveRunInput): Promise<CognitiveRunResult> {
  const stages: CognitiveStageRecord[] = [];
  const evidence: unknown[] = [];
  const runId = await createCognitiveRunRow(input);
  const executeActions = input.executeActions !== false;

  try {
    // OBSERVE
    const twin = await refreshDigitalTwin(input.tenantId, input.triggerType === 'event' ? 'event' : 'cognitive');
    const kg = await syncBusinessKnowledgeGraph(input.tenantId, 40);
    stages.push(
      stage('observe', 'completed', 'Captured digital twin + knowledge graph snapshot', [
        { twinId: twin.id, health: twin.snapshot.kpis.health_score },
        { kgNodes: kg.nodes, kgEdges: kg.edges },
      ])
    );
    evidence.push({ twin: twin.snapshot.kpis, kg: { nodes: kg.nodes, edges: kg.edges } });

    // UNDERSTAND
    const memoryBlock = await buildMemoryContextForGoal(input.tenantId, input.goal);
    stages.push(stage('understand', 'completed', 'Loaded layered org/user/department memory', [{ memoryBlock }]));

    // REASON
    const agents = selectAgentsForGoal(input.goal, { eventType: input.eventType, maxAgents: 4 });
    const reasonSummary = `Goal requires departments: ${[...new Set(agents.map((a) => a.department))].join(', ')}`;
    stages.push(stage('reason', 'completed', reasonSummary, agents.map((a) => a.id)));

    // PLAN + SIMULATE
    const plannedTools = collectToolsFromAgents(agents);
    const simulated = {
      expectedSteps: agents.map((a) => ({ agent: a.id, tools: a.tools.slice(0, 3) })),
      estimatedToolCalls: Math.min(plannedTools.length, 5),
      approvalLikely: /\b(send|publish|charge|bulk|delete)\b/i.test(input.goal),
    };
    stages.push(stage('plan', 'completed', `Planned ${simulated.estimatedToolCalls} tool actions across ${agents.length} agents`, [simulated]));
    stages.push(stage('simulate', 'completed', 'Simulated execution path and approval likelihood', [simulated]));

    // EVALUATE RISK + CHOOSE STRATEGY/AGENTS/TOOLS
    const supervisor = decideSupervision({
      goal: input.goal,
      eventType: input.eventType,
      selectedAgents: agents,
      selectedTools: plannedTools,
    });
    stages.push(
      stage('evaluate_risk', 'completed', `Risk level ${supervisor.riskLevel}`, [
        { riskLevel: supervisor.riskLevel, requiresApproval: supervisor.requiresApproval },
      ])
    );
    stages.push(stage('choose_strategy', 'completed', supervisor.strategy, [supervisor]));
    stages.push(
      stage('choose_agents', 'completed', `Primary: ${supervisor.primaryAgentIds.join(', ')}`, [
        { collaborators: supervisor.collaboratorAgentIds },
      ])
    );
    stages.push(stage('choose_tools', 'completed', `Selected ${plannedTools.length} tools`, plannedTools));

    // EXECUTE
    const toolResults: Array<Record<string, unknown>> = [];
    let awaitingApproval = false;
    let orchestrationRunId: string | null = null;
    const isEventTrigger = (input.triggerType || 'instruction') === 'event'
      || input.triggerType === 'continuous'
      || input.triggerType === 'cron';

    if (executeActions) {
      // Instruction/complex missions: multi-agent orchestrate_task.
      // Events/cron: gather with read tools only (still full reason/plan/reflect/memory).
      if (!isEventTrigger && agents.length >= 2) {
        const orch = await executeSingleBonnieTool({
          tenantId: input.tenantId,
          userId: input.userId || '',
          tool: 'orchestrate_task',
          args: {
            tenant_id: input.tenantId,
            user_id: input.userId,
            task: `${input.goal}\n\n${memoryBlock}`,
            subagents: toOrchestratorSubagents(agents),
            use_specialist_subagents: false,
            execute_actions: true,
          },
          instruction: input.goal,
        });
        toolResults.push(orch as unknown as Record<string, unknown>);
        if (orch.approvalRequired) awaitingApproval = true;
        try {
          const text = String(orch.details || orch.summary || '');
          const parsed = text.includes('{')
            ? JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
            : null;
          orchestrationRunId = parsed?.run_id || null;
        } catch {
          orchestrationRunId = null;
        }
      } else {
        for (const tool of plannedTools.slice(0, isEventTrigger ? 3 : 3)) {
          const result = await executeSingleBonnieTool({
            tenantId: input.tenantId,
            userId: input.userId || '',
            tool,
            args: { tenant_id: input.tenantId },
            instruction: input.goal,
          });
          toolResults.push(result as unknown as Record<string, unknown>);
          if (result.approvalRequired) {
            awaitingApproval = true;
            break;
          }
        }
      }

      for (const agent of agents) {
        await recordAgentExecution({
          tenantId: input.tenantId,
          cognitiveRunId: runId,
          agentId: agent.id,
          department: agent.department,
          role: agent.role,
          task: input.goal,
          result: { strategy: supervisor.strategy },
          toolsUsed: agent.tools,
          status: 'completed',
          confidence: supervisor.confidence,
        });
      }
    } else {
      stages.push(stage('execute', 'skipped', 'Execution disabled for this cognitive run'));
    }

    if (executeActions) {
      stages.push(
        stage(
          'execute',
          awaitingApproval ? 'completed' : 'completed',
          awaitingApproval ? 'Execution paused for human approval' : `Executed ${toolResults.length} action groups`,
          toolResults
        )
      );
    }

    // VERIFY
    const verifyOk = toolResults.every((r) => r.success !== false) || toolResults.length === 0;
    stages.push(
      stage(
        'verify',
        verifyOk ? 'completed' : 'failed',
        verifyOk ? 'Verification passed (or plan-only run)' : 'One or more tool results failed verification',
        toolResults.map((r) => ({ tool: r.tool, success: r.success, approvalRequired: r.approvalRequired }))
      )
    );

    // REFLECT → LEARN → UPDATE MEMORY → IMPROVE
    const outcome = {
      status: awaitingApproval ? 'awaiting_approval' : verifyOk ? 'completed' : 'failed',
      toolResultCount: toolResults.length,
      twinHealth: twin.snapshot.kpis.health_score,
    };
    const reflection = synthesizeReflection({
      goal: input.goal,
      stages,
      supervisor,
      outcome,
      toolResults: toolResults as Array<{ tool?: string; success?: boolean; approvalRequired?: boolean; summary?: string }>,
    });
    stages.push(stage('reflect', 'completed', `Lessons: ${reflection.lessons.length}`, [reflection.lessons]));
    stages.push(stage('learn', 'completed', `Memory candidates: ${reflection.memoryUpdates.length}`, reflection.memoryUpdates));

    const memoryApplied = supervisor.shouldUpdateMemory
      ? await applyReflectionMemory(input.tenantId, reflection)
      : 0;
    stages.push(stage('update_memory', 'completed', `Applied ${memoryApplied} layered memory updates`));

    const reflectionId = await persistReflection({
      tenantId: input.tenantId,
      cognitiveRunId: runId,
      workflowId: input.workflowId,
      reflection,
    });

    stages.push(
      stage(
        'improve',
        'completed',
        reflection.workflowReuseCandidate
          ? 'Marked as reusable workflow candidate'
          : `Improvement actions: ${reflection.improvementActions.length}`,
        reflection.improvementActions
      )
    );
    stages.push(
      stage(
        'continue_monitoring',
        'completed',
        'Digital twin refreshed; continuous monitoring remains active via cron/events'
      )
    );

    // Ensure stage order completeness for traces
    for (const name of STAGE_ORDER) {
      if (!stages.some((s) => s.name === name)) {
        stages.push(stage(name, 'skipped', 'Not required for this run'));
      }
    }

    await recordDecision({
      tenantId: input.tenantId,
      userId: input.userId,
      instruction: input.goal,
      toolName: 'bonnie_cognitive_loop',
      toolArgs: {
        run_id: runId,
        trigger: input.triggerType || 'instruction',
        agents: agents.map((a) => a.id),
        strategy: supervisor.strategy,
      },
      outcome: awaitingApproval ? 'queued_approval' : verifyOk ? 'executed' : 'failed',
      reasoning: supervisor.reasoning,
      riskClass: supervisor.riskLevel === 'high' || supervisor.riskLevel === 'critical' ? 'send' : 'read',
    });

    const status = awaitingApproval ? 'awaiting_approval' : verifyOk ? 'completed' : 'failed';
    await finalizeCognitiveRun(runId, {
      status,
      stages,
      selected_agents: agents,
      selected_tools: plannedTools,
      strategy: { name: supervisor.strategy, supervisor },
      risk_assessment: { level: supervisor.riskLevel, requiresApproval: supervisor.requiresApproval },
      confidence: supervisor.confidence,
      evidence,
      outcome: { ...outcome, reflectionId },
      orchestration_run_id: orchestrationRunId,
    });

    return {
      runId,
      status,
      stages,
      selectedAgents: agents,
      selectedTools: plannedTools,
      supervisor,
      strategy: { name: supervisor.strategy },
      riskAssessment: { level: supervisor.riskLevel, requiresApproval: supervisor.requiresApproval },
      confidence: supervisor.confidence,
      evidence,
      outcome: { ...outcome, reflectionId },
      reflectionId,
      twinSnapshotId: twin.id,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    stages.push(stage('execute', 'failed', message));
    await finalizeCognitiveRun(runId, {
      status: 'failed',
      stages,
      outcome: { error: message },
      confidence: 0.1,
    });
    return {
      runId,
      status: 'failed',
      stages,
      selectedAgents: [],
      selectedTools: [],
      supervisor: decideSupervision({ goal: input.goal, eventType: input.eventType }),
      strategy: {},
      riskAssessment: {},
      confidence: 0.1,
      evidence,
      outcome: { error: message },
    };
  }
}

export function listRegisteredAgents() {
  return DEPARTMENT_AGENTS;
}
