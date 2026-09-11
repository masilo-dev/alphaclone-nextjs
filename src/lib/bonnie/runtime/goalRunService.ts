/**
 * Goal + Run service — persistent runs independent of chat.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createGoalFromPlan } from '@/lib/bonnie/os/goalEngine';
import { selectAgentsForGoal, collectToolsFromAgents, decideSupervision } from '@/lib/bonnie/os/supervisor';
import type { AgentRunRow, RunStatus } from './types';
import { createInitialGraphForObjective } from './plannerService';
import { verifyRunOutcomes } from './verificationService';

const ALLOWED_AGENT_RUN_EXECUTION_MODES = new Set([
  'ask_only',
  'plan_only',
  'approval_required',
  'semi_autonomous',
  'fully_autonomous',
]);

/** Map legacy/alias modes to values allowed by agent_runs_execution_mode_check. */
export function normalizeAgentRunExecutionMode(
  mode?: string | null,
  fallback: string = 'semi_autonomous'
): string {
  const trimmed = String(mode || '').trim();
  if (ALLOWED_AGENT_RUN_EXECUTION_MODES.has(trimmed)) return trimmed;
  if (trimmed === 'autonomous' || trimmed === 'auto') return 'fully_autonomous';
  if (trimmed === 'approval' || trimmed === 'manual') return 'approval_required';
  if (trimmed === 'plan') return 'plan_only';
  if (trimmed === 'ask') return 'ask_only';
  return ALLOWED_AGENT_RUN_EXECUTION_MODES.has(fallback) ? fallback : 'semi_autonomous';
}

export async function createRunForObjective(params: {
  tenantId: string;
  userId?: string | null;
  workspaceId?: string | null;
  conversationId?: string | null;
  objective: string;
  executionMode?: string;
  priority?: number;
  successCriteria?: Record<string, unknown>;
  seedGraph?: boolean;
}): Promise<{ run: AgentRunRow; goalId: string | null; graphId?: string | null }> {
  const admin = createSupabaseAdminClient();
  const agents = selectAgentsForGoal(params.objective, { maxAgents: 4 });
  const tools = collectToolsFromAgents(agents);
  const supervisor = decideSupervision({
    goal: params.objective,
    selectedAgents: agents,
    selectedTools: tools,
  });

  let goalId: string | null = null;
  try {
    const goal = await createGoalFromPlan({
      tenantId: params.tenantId,
      userId: params.userId,
      goal: params.objective,
      agents,
      tools,
      riskLevel: supervisor.riskLevel,
      requiresApproval: supervisor.requiresApproval,
      triggerType: 'instruction',
      conversationId: params.conversationId,
      metadata: { durableRuntime: true },
    });
    goalId = goal?.id || null;
  } catch (err) {
    console.warn('[goalRunService] goal create failed:', err);
  }

  const { data: run, error } = await admin
    .from('agent_runs')
    .insert({
      tenant_id: params.tenantId,
      workspace_id: params.workspaceId || null,
      goal_id: goalId,
      user_id: params.userId || null,
      conversation_id: params.conversationId || null,
      title: params.objective.slice(0, 120) || 'Untitled run',
      description: params.objective,
      success_criteria: params.successCriteria || {
        requireVerifiedOutcomes: true,
        allowPartial: true,
      },
      execution_mode: normalizeAgentRunExecutionMode(
        params.executionMode,
        supervisor.requiresApproval ? 'approval_required' : 'semi_autonomous'
      ),
      priority: params.priority || 3,
      status: 'planning' satisfies RunStatus,
      metadata: {
        agentIds: agents.map((a) => a.id),
        plannedTools: tools,
        supervisor,
      },
    })
    .select('*')
    .single();

  if (error || !run) {
    throw new Error(error?.message || 'Failed to create agent run');
  }

  let graphId: string | null = null;
  if (params.seedGraph !== false) {
    const graph = await createInitialGraphForObjective({
      tenantId: params.tenantId,
      runId: run.id,
      objective: params.objective,
      agentIds: agents.map((a) => a.id),
      correlationId: run.correlation_id,
    });
    graphId = graph.graphId;
  }

  return { run: run as AgentRunRow, goalId, graphId };
}

export async function getRun(runId: string, tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data as AgentRunRow | null;
}

export async function listRuns(params: {
  tenantId: string;
  goalId?: string;
  status?: RunStatus[];
  limit?: number;
}) {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from('agent_runs')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .order('updated_at', { ascending: false })
    .limit(params.limit || 40);
  if (params.goalId) q = q.eq('goal_id', params.goalId);
  if (params.status?.length) q = q.in('status', params.status);
  const { data } = await q;
  return (data || []) as AgentRunRow[];
}

export async function getRunProgressSummary(runId: string, tenantId: string) {
  const admin = createSupabaseAdminClient();
  const run = await getRun(runId, tenantId);
  if (!run) return null;

  const { data: tasks } = await admin
    .from('agent_tasks')
    .select('id, status, title, assigned_agent_id, failure_reason, updated_at')
    .eq('run_id', runId)
    .eq('tenant_id', tenantId);

  const list = tasks || [];
  const byStatus: Record<string, number> = {};
  for (const t of list) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  }

  const total = list.length || 1;
  const done = (byStatus.COMPLETED || 0) + (byStatus.SKIPPED || 0);
  const failed = byStatus.FAILED || 0;
  const waiting =
    (byStatus.WAITING_FOR_EVENT || 0) +
    (byStatus.WAITING_FOR_APPROVAL || 0) +
    (byStatus.WAITING_FOR_USER || 0) +
    (byStatus.RETRY_SCHEDULED || 0) +
    (byStatus.EXECUTION_UNCERTAIN || 0);
  const running = (byStatus.RUNNING || 0) + (byStatus.CLAIMED || 0) + (byStatus.QUEUED || 0) + (byStatus.READY || 0);

  const progressPct = Math.round((done / total) * 100);
  const terminal = list.length > 0 && running === 0 && waiting === 0;
  let verification = null as Awaited<ReturnType<typeof verifyRunOutcomes>> | null;

  if (terminal && (done + failed >= total || failed > 0)) {
    try {
      verification = await verifyRunOutcomes({ tenantId, runId });
    } catch (err) {
      console.warn('[goalRunService] verification failed:', err);
    }
  }

  const nextStatus = verification
    ? verification.outcome === 'COMPLETED'
      ? 'completed'
      : verification.outcome === 'COMPLETED_WITH_EXCEPTIONS'
        ? 'completed_with_exceptions'
        : verification.outcome === 'FAILED'
          ? 'failed'
          : verification.outcome === 'PARTIALLY_COMPLETED'
            ? 'partially_completed'
            : failed && done + failed >= total
              ? 'completed_with_exceptions'
              : done >= total
                ? 'completed'
                : 'running'
    : failed && done + failed >= total
      ? 'completed_with_exceptions'
      : done >= total
        ? 'completed'
        : waiting && !running
          ? 'waiting'
          : 'running';

  await admin
    .from('agent_runs')
    .update({
      progress_pct: progressPct,
      last_progress_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: nextStatus,
      ...(String(nextStatus).startsWith('completed') || nextStatus === 'failed' || nextStatus === 'partially_completed'
        ? { completed_at: new Date().toISOString() }
        : {}),
    })
    .eq('id', runId)
    .eq('tenant_id', tenantId);

  return {
    run,
    taskCount: list.length,
    byStatus,
    progressPct,
    summary: verification?.summary
      || `Bonnie has ${done} completed, ${running} active, ${waiting} waiting, and ${failed} failed of ${list.length} tasks.`,
    verification,
    tasks: list,
  };
}

export async function requestRunCancellation(runId: string, tenantId: string, reason?: string) {
  const admin = createSupabaseAdminClient();
  await admin
    .from('agent_runs')
    .update({
      status: 'cancellation_requested',
      failure_reason: reason || 'Cancellation requested by user',
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .eq('tenant_id', tenantId);

  // Prevent new READY tasks; cancel DRAFT/READY/QUEUED
  const { data: open } = await admin
    .from('agent_tasks')
    .select('id, status, version')
    .eq('run_id', runId)
    .eq('tenant_id', tenantId)
    .in('status', ['DRAFT', 'READY', 'QUEUED', 'RETRY_SCHEDULED', 'WAITING_FOR_EVENT', 'WAITING_FOR_APPROVAL']);

  for (const task of open || []) {
    await admin
      .from('agent_tasks')
      .update({
        status: 'CANCELLED',
        version: (task.version || 1) + 1,
        failure_reason: 'Run cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id)
      .eq('version', task.version);
  }

  return { ok: true };
}
