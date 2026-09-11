/**
 * Graph service — transactional create / expand.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { GraphDependencyInput, GraphTaskInput } from './types';
import { insertOutboxEvent } from './outboxService';

export async function createGraphTransactional(params: {
  tenantId: string;
  runId: string;
  tasks: GraphTaskInput[];
  dependencies?: GraphDependencyInput[];
  reason?: string;
  actorType?: string;
  actorId?: string;
}): Promise<{ graphId: string; version: number; taskIds: string[]; idMap: Record<string, string> }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('create_agent_graph_transaction', {
    p_tenant_id: params.tenantId,
    p_run_id: params.runId,
    p_tasks: params.tasks,
    p_dependencies: params.dependencies || [],
    p_reason: params.reason || 'initial_plan',
    p_actor_type: params.actorType || 'planner',
    p_actor_id: params.actorId || 'executive',
  });

  if (error) {
    throw new Error(`create_agent_graph_transaction failed: ${error.message}`);
  }

  const result = data as {
    graphId: string;
    version: number;
    taskIds: string[];
    idMap: Record<string, string>;
  };

  // Outbox for each READY task (post-commit best-effort; RPC already committed)
  const { data: readyTasks } = await admin
    .from('agent_tasks')
    .select('id, run_id, correlation_id, status')
    .eq('run_id', params.runId)
    .eq('tenant_id', params.tenantId)
    .eq('status', 'READY');

  for (const task of readyTasks || []) {
    await insertOutboxEvent({
      tenantId: params.tenantId,
      eventType: 'task.ready',
      payload: {
        task_id: task.id,
        run_id: task.run_id,
        tenant_id: params.tenantId,
        correlation_id: task.correlation_id,
      },
      correlationId: task.correlation_id,
    });
  }

  return {
    graphId: result.graphId,
    version: result.version,
    taskIds: result.taskIds || [],
    idMap: (result.idMap || {}) as Record<string, string>,
  };
}

export async function expandGraph(params: {
  tenantId: string;
  runId: string;
  graphId: string;
  reason: string;
  actorType: string;
  actorId: string;
  tasks: GraphTaskInput[];
  dependencies?: GraphDependencyInput[];
}) {
  const admin = createSupabaseAdminClient();
  const { data: graph } = await admin
    .from('agent_graphs')
    .select('*')
    .eq('id', params.graphId)
    .eq('tenant_id', params.tenantId)
    .single();
  if (!graph) throw new Error('graph not found');

  const nextVersion = Number(graph.current_version || 1) + 1;

  await admin.from('agent_graph_versions').insert({
    tenant_id: params.tenantId,
    graph_id: params.graphId,
    version: nextVersion,
    reason: params.reason,
    actor_type: params.actorType,
    actor_id: params.actorId,
    snapshot: { tasks: params.tasks, dependencies: params.dependencies || [] },
  });

  const idMap: Record<string, string> = {};
  for (const task of params.tasks) {
    const { data: row, error } = await admin
      .from('agent_tasks')
      .insert({
        tenant_id: params.tenantId,
        run_id: params.runId,
        graph_id: params.graphId,
        graph_version: nextVersion,
        assigned_agent_id: task.assignedAgentId || null,
        task_type: task.taskType || 'generic',
        title: task.title,
        structured_input: task.structuredInput || {},
        expected_output_schema: task.expectedOutputSchema || {},
        status: task.status || 'DRAFT',
        priority: task.priority || 3,
        risk_level: task.riskLevel || 'low',
        approval_policy: task.approvalPolicy || {},
        retry_policy: task.retryPolicy || { maxAttempts: 3, backoffMs: 60000 },
        timeout_policy: task.timeoutPolicy || { executionMs: 300000 },
        verification_criteria: task.verificationCriteria || {},
        max_attempts: task.maxAttempts || 3,
        idempotency_key: task.idempotencyKey || null,
        metadata: { ...(task.metadata || {}), expandReason: params.reason },
      })
      .select('id')
      .single();
    if (error || !row) throw new Error(error?.message || 'task insert failed');
    idMap[task.tempId] = row.id;
  }

  for (const dep of params.dependencies || []) {
    await admin.from('agent_task_dependencies').insert({
      tenant_id: params.tenantId,
      run_id: params.runId,
      task_id: idMap[dep.taskTempId],
      depends_on_task_id: idMap[dep.dependsOnTempId],
      dependency_type: dep.dependencyType || 'finish_to_start',
      condition: dep.condition || {},
    });
  }

  await admin
    .from('agent_graphs')
    .update({ current_version: nextVersion, updated_at: new Date().toISOString() })
    .eq('id', params.graphId);

  return { version: nextVersion, idMap };
}

export async function getGraphForRun(runId: string, tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data: graph } = await admin
    .from('agent_graphs')
    .select('*')
    .eq('run_id', runId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!graph) return null;

  const [{ data: tasks }, { data: deps }, { data: versions }] = await Promise.all([
    admin.from('agent_tasks').select('*').eq('graph_id', graph.id).order('created_at', { ascending: true }),
    admin.from('agent_task_dependencies').select('*').eq('run_id', runId),
    admin
      .from('agent_graph_versions')
      .select('id, version, reason, actor_type, actor_id, created_at')
      .eq('graph_id', graph.id)
      .order('version', { ascending: true }),
  ]);

  return { graph, tasks: tasks || [], dependencies: deps || [], versions: versions || [] };
}
