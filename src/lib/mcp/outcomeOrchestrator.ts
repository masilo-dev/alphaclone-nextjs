/**
 * Outcome orchestrator — request multi-step business outcomes via durable Bonnie runtime.
 */

import { randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createRunForObjective } from '@/lib/bonnie/runtime/goalRunService';
import { createGraphTransactional } from '@/lib/bonnie/runtime/graphService';
import { getRunProgressSummary } from '@/lib/bonnie/runtime/goalRunService';
import { processNormalizedTrigger } from '@/lib/bonnie/runtime/triggerGateway';
import type { GraphDependencyInput, GraphTaskInput } from '@/lib/bonnie/runtime/types';
import {
  getOutcomeMission,
  type OutcomeMissionDefinition,
  type OutcomeStepDefinition,
} from '@/lib/mcp/outcomeDefinitions';
import {
  adaptIntent,
  normalizeOutcomeParams,
  type ParsedOutcomeIntent,
} from '@/lib/mcp/intentAdapter';

export type RequestOutcomeInput = {
  tenantId: string;
  userId: string;
  outcome_key?: string;
  intent?: string;
  objective?: string;
  params?: Record<string, unknown>;
  idempotency_key?: string;
  source?: string;
};

export type RequestOutcomeResult = {
  ok: boolean;
  outcome_key: string;
  run_id: string;
  graph_id: string;
  task_ids: string[];
  correlation_id: string;
  execute: boolean;
  steps_planned: number;
  intent: ParsedOutcomeIntent;
  poll_tool: string;
  error?: string;
  missing_params?: string[];
};

function shouldSkipStep(step: OutcomeStepDefinition, params: Record<string, unknown>): boolean {
  if (step.skipWhen === 'execute_false' && params.execute !== true) return true;
  if (step.skipWhen === 'has_invoice_id' && params.invoice_id) return true;
  if (step.skipWhen === 'missing_invoice_id' && !params.invoice_id) return true;
  if (step.skipWhen === 'has_project_id' && params.project_id) return true;
  if (step.skipWhen === 'missing_project_id' && !params.project_id) return true;
  return false;
}

function buildStepArgs(
  step: OutcomeStepDefinition,
  params: Record<string, unknown>,
  priorOutputs: Record<string, unknown>
): Record<string, unknown> {
  const args: Record<string, unknown> = { ...(step.staticArgs || {}) };
  for (const key of step.bindParams || []) {
    if (params[key] !== undefined) args[key] = params[key];
  }
  for (const [argKey, priorPath] of Object.entries(step.bindFromPrior || {})) {
    const [stepId, field] = priorPath.split('.');
    const stepOut = priorOutputs[stepId];
    if (stepOut && typeof stepOut === 'object' && field in (stepOut as object)) {
      args[argKey] = (stepOut as Record<string, unknown>)[field];
    }
  }
  return args;
}

function missionToGraphTasks(
  mission: OutcomeMissionDefinition,
  params: Record<string, unknown>
): { tasks: GraphTaskInput[]; dependencies: GraphDependencyInput[]; activeSteps: OutcomeStepDefinition[] } {
  const activeSteps = mission.steps.filter((step) => !shouldSkipStep(step, params));
  const tasks: GraphTaskInput[] = activeSteps.map((step, index) => ({
    tempId: `outcome_${step.id}`,
    title: step.title,
    taskType: 'outcome.execute_step',
    assignedAgentId: 'outcome',
    status: index === 0 ? 'READY' : 'DRAFT',
    riskLevel: step.mode === 'execute_now' ? 'high' : step.mode === 'dry_run' ? 'low' : 'medium',
    structuredInput: {
      outcome_key: mission.key,
      step_id: step.id,
      tool: step.tool,
      mode: step.mode,
      args: buildStepArgs(step, params, {}),
      bind_from_prior: step.bindFromPrior || {},
      params_snapshot: {
        execute: params.execute === true,
      },
    },
    retryPolicy: { maxAttempts: 3, backoffMs: 45_000 },
    metadata: { outcome_step: step.id, tool: step.tool },
  }));

  const dependencies: GraphDependencyInput[] = [];
  for (let i = 1; i < activeSteps.length; i++) {
    dependencies.push({
      taskTempId: `outcome_${activeSteps[i].id}`,
      dependsOnTempId: `outcome_${activeSteps[i - 1].id}`,
      dependencyType: 'finish_to_start',
    });
  }

  return { tasks, dependencies, activeSteps };
}

export async function requestOutcome(input: RequestOutcomeInput): Promise<RequestOutcomeResult> {
  const parsed = adaptIntent({
    outcome_key: input.outcome_key,
    intent: input.intent,
    objective: input.objective,
  });

  if (!parsed) {
    return {
      ok: false,
      outcome_key: input.outcome_key || 'unknown',
      run_id: '',
      graph_id: '',
      task_ids: [],
      correlation_id: '',
      execute: false,
      steps_planned: 0,
      intent: {
        outcome_key: 'unknown',
        mission: getOutcomeMission('content_to_publish')!,
        confidence: 'fallback',
      },
      poll_tool: 'get_outcome_status',
      error: 'Could not resolve outcome — pass outcome_key or a clearer intent/objective.',
    };
  }

  const { params, missing } = normalizeOutcomeParams(parsed.mission, input.params || {});
  if (missing.length) {
    return {
      ok: false,
      outcome_key: parsed.outcome_key,
      run_id: '',
      graph_id: '',
      task_ids: [],
      correlation_id: '',
      execute: params.execute === true,
      steps_planned: 0,
      intent: parsed,
      poll_tool: 'get_outcome_status',
      error: `Missing required params: ${missing.join(', ')}`,
      missing_params: missing,
    };
  }

  const correlationId = input.idempotency_key || `outcome-${parsed.outcome_key}-${randomUUID()}`;

  await processNormalizedTrigger({
    tenant_id: input.tenantId,
    user_id: input.userId,
    trigger_type: 'api_request',
    event_type: `outcome.${parsed.outcome_key}`,
    source: input.source || 'request_outcome',
    correlation_id: correlationId,
    deduplication_key: correlationId,
    payload: {
      outcome_key: parsed.outcome_key,
      execute: params.execute === true,
      params: {
        ...params,
        caption: params.caption ? '[redacted]' : undefined,
        text: params.text ? '[redacted]' : undefined,
      },
    },
  }).catch(() => undefined);

  const runResult = await createRunForObjective({
    tenantId: input.tenantId,
    userId: input.userId,
    objective: `${parsed.mission.title}: ${input.intent || input.objective || parsed.outcome_key}`,
    executionMode: params.execute === true ? 'autonomous' : 'approval_required',
    successCriteria: {
      outcome_key: parsed.outcome_key,
      requireVerifiedOutcomes: true,
      execute: params.execute === true,
    },
    seedGraph: false,
  });

  const admin = createSupabaseAdminClient();
  await admin
    .from('agent_runs')
    .update({
      metadata: {
        ...(runResult.run.metadata as Record<string, unknown> | undefined),
        outcome_key: parsed.outcome_key,
        correlation_id: correlationId,
        execute: params.execute === true,
      },
    })
    .eq('id', runResult.run.id)
    .eq('tenant_id', input.tenantId);

  const { tasks, dependencies, activeSteps } = missionToGraphTasks(parsed.mission, params);
  const graph = await createGraphTransactional({
    tenantId: input.tenantId,
    runId: runResult.run.id,
    tasks,
    dependencies,
    reason: `outcome:${parsed.outcome_key}`,
    actorType: 'outcome_orchestrator',
    actorId: input.userId,
  });

  return {
    ok: true,
    outcome_key: parsed.outcome_key,
    run_id: runResult.run.id,
    graph_id: graph.graphId,
    task_ids: graph.taskIds,
    correlation_id: correlationId,
    execute: params.execute === true,
    steps_planned: activeSteps.length,
    intent: parsed,
    poll_tool: 'get_outcome_status',
  };
}

export async function getOutcomeStatus(input: {
  tenantId: string;
  runId: string;
}): Promise<Record<string, unknown>> {
  const admin = createSupabaseAdminClient();
  const progress = await getRunProgressSummary(input.runId, input.tenantId);
  const { data: run } = await admin
    .from('agent_runs')
    .select('id, status, title, metadata, success_criteria, correlation_id, created_at, completed_at')
    .eq('id', input.runId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  const { data: tasks } = await admin
    .from('agent_tasks')
    .select('id, title, status, task_type, structured_input, structured_output, failure_reason, updated_at')
    .eq('run_id', input.runId)
    .eq('tenant_id', input.tenantId)
    .order('created_at', { ascending: true });

  const stepResults = (tasks || [])
    .filter((t) => t.task_type === 'outcome.execute_step')
    .map((t) => ({
      step_id: (t.structured_input as Record<string, unknown>)?.step_id,
      tool: (t.structured_input as Record<string, unknown>)?.tool,
      status: t.status,
      failure_reason: t.failure_reason,
      output: t.structured_output,
    }));

  return {
    run_id: input.runId,
    outcome_key: (run?.metadata as Record<string, unknown> | undefined)?.outcome_key || null,
    run_status: run?.status || null,
    correlation_id: run?.correlation_id || null,
    progress,
    steps: stepResults,
    completed:
      (progress?.byStatus?.COMPLETED || 0) + (progress?.byStatus?.SKIPPED || 0),
    total: progress?.taskCount || stepResults.length,
    verification: progress?.verification || null,
  };
}
