import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type StartWorkflowInput = {
  tenantId: string;
  userId?: string | null;
  objective: string;
  scope?: string[];
  customerIdentity?: {
    name?: string;
    email?: string;
    client_id?: string;
    contact_id?: string;
  };
  isTestData?: boolean;
  testRunId?: string;
  initialRecords?: Record<string, string>;
};

export type WorkflowState = {
  objective: string;
  scope: string[];
  canonical_customer: {
    name?: string;
    email?: string;
    client_id?: string;
    contact_id?: string;
  };
  created_records: Record<string, string>;
  step_outcomes: Record<string, unknown>;
  approvals: Array<{
    id: string;
    type: string;
    status: 'pending' | 'approved' | 'rejected' | 'invalidated';
    requested_at: string;
    checksum?: string;
  }>;
  provider_receipts: Array<Record<string, unknown>>;
  next_action?: string;
  recovery_state?: Record<string, unknown>;
  is_test_data: boolean;
  test_run_id?: string;
};

export async function startWorkflow(
  input: StartWorkflowInput,
  client?: SupabaseClient
) {
  const supabase = client || createSupabaseAdminClient();
  const now = new Date().toISOString();
  const correlationId = randomUUID();

  const initialState: WorkflowState = {
    objective: input.objective,
    scope: input.scope || ['lead', 'qualify', 'client', 'deal', 'quote', 'contract', 'invoice', 'project', 'portal'],
    canonical_customer: input.customerIdentity || {},
    created_records: input.initialRecords || {},
    step_outcomes: {},
    approvals: [],
    provider_receipts: [],
    next_action: 'qualify_prospect',
    is_test_data: Boolean(input.isTestData),
    test_run_id: input.testRunId,
  };

  const { data: run, error } = await supabase
    .from('agent_runs')
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId || null,
      title: input.objective.slice(0, 200),
      description: `Workflow run for: ${input.objective}`,
      status: 'running',
      progress_pct: 0,
      execution_mode: 'semi_autonomous',
      correlation_id: correlationId,
      started_at: now,
      last_progress_at: now,
      metadata: {
        workflow_state: initialState,
        is_test_data: Boolean(input.isTestData),
        test_run_id: input.testRunId,
      },
    })
    .select('*')
    .single();

  if (error || !run) {
    throw new Error(`Failed to create workflow run: ${error?.message || 'unknown error'}`);
  }

  return {
    success: true,
    run_id: run.id,
    correlation_id: correlationId,
    status: run.status,
    progress_pct: 0,
    created_at: run.created_at,
    next_action: initialState.next_action,
    poll_tool: 'inspect_workflow',
  };
}

export async function inspectWorkflow(
  tenantId: string,
  runId: string,
  client?: SupabaseClient
) {
  const supabase = client || createSupabaseAdminClient();
  const { data: run, error } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !run) {
    throw new Error(`Workflow run not found: ${runId}`);
  }

  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('id, title, status, task_type, structured_output, failure_reason, updated_at, created_at')
    .eq('run_id', runId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  const metadata = (run.metadata || {}) as Record<string, unknown>;
  const state = (metadata.workflow_state || {}) as WorkflowState;

  // Stale run detection: If run is 'running' but last_progress_at was > 5 minutes ago and no active task progress
  const lastProgressMs = run.last_progress_at ? new Date(run.last_progress_at).getTime() : new Date(run.created_at).getTime();
  const ageSeconds = Math.round((Date.now() - lastProgressMs) / 1000);
  const isStalled = run.status === 'running' && ageSeconds > 300;

  const effectiveStatus = isStalled ? 'stalled' : run.status;

  const completedTasks = (tasks || []).filter((t) => t.status === 'COMPLETED');
  const pendingTasks = (tasks || []).filter((t) => t.status === 'READY' || t.status === 'QUEUED' || t.status === 'RUNNING');
  const failedTasks = (tasks || []).filter((t) => t.status === 'FAILED');

  const recoveryAction = isStalled
    ? 'Workflow appears stalled (no activity in > 5m). Call resume_workflow to safely resume execution.'
    : failedTasks.length > 0
    ? `Task "${failedTasks[0]?.title}" failed with: ${failedTasks[0]?.failure_reason || 'unknown'}. Resolve blocker and resume_workflow.`
    : null;

  return {
    success: true,
    run_id: run.id,
    title: run.title,
    status: effectiveStatus,
    raw_status: run.status,
    is_stalled: isStalled,
    progress_pct: run.progress_pct || 0,
    started_at: run.started_at,
    last_activity_at: run.last_progress_at || run.updated_at,
    heartbeat_age_seconds: ageSeconds,
    canonical_customer: state.canonical_customer || {},
    created_records: state.created_records || {},
    approvals: state.approvals || [],
    provider_receipts: state.provider_receipts || [],
    completed_steps_count: completedTasks.length,
    remaining_steps_count: pendingTasks.length,
    completed_steps: completedTasks.map((t) => ({ id: t.id, title: t.title, output: t.structured_output })),
    pending_steps: pendingTasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
    next_action: state.next_action || (pendingTasks[0] ? pendingTasks[0].title : 'complete'),
    recovery_action: recoveryAction,
    is_test_data: Boolean(metadata.is_test_data),
    test_run_id: metadata.test_run_id || null,
  };
}

export async function resumeWorkflow(
  tenantId: string,
  runId: string,
  fromStepId?: string,
  client?: SupabaseClient
) {
  const supabase = client || createSupabaseAdminClient();
  const { data: run, error } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !run) {
    throw new Error(`Workflow run not found: ${runId}`);
  }

  const now = new Date().toISOString();
  await supabase
    .from('agent_runs')
    .update({
      status: 'running',
      last_progress_at: now,
      updated_at: now,
    })
    .eq('id', runId)
    .eq('tenant_id', tenantId);

  // If a specific task failed, reset it to READY
  if (fromStepId) {
    await supabase
      .from('agent_tasks')
      .update({ status: 'READY', failure_reason: null, updated_at: now })
      .eq('id', fromStepId)
      .eq('run_id', runId)
      .eq('tenant_id', tenantId);
  } else {
    // Reset any failed task to READY
    await supabase
      .from('agent_tasks')
      .update({ status: 'READY', failure_reason: null, updated_at: now })
      .eq('run_id', runId)
      .eq('tenant_id', tenantId)
      .eq('status', 'FAILED');
  }

  return {
    success: true,
    run_id: runId,
    status: 'running',
    resumed_at: now,
    message: 'Workflow execution resumed.',
    poll_tool: 'inspect_workflow',
  };
}

export async function cancelWorkflow(
  tenantId: string,
  runId: string,
  reason: string = 'User requested cancellation',
  client?: SupabaseClient
) {
  const supabase = client || createSupabaseAdminClient();
  const now = new Date().toISOString();

  await Promise.all([
    supabase
      .from('agent_runs')
      .update({
        status: 'cancelled',
        failure_reason: reason,
        completed_at: now,
        updated_at: now,
      })
      .eq('id', runId)
      .eq('tenant_id', tenantId),
    supabase
      .from('agent_tasks')
      .update({
        status: 'CANCELLED',
        failure_reason: reason,
        updated_at: now,
      })
      .eq('run_id', runId)
      .eq('tenant_id', tenantId)
      .in('status', ['READY', 'QUEUED', 'RUNNING', 'DRAFT']),
  ]);

  return {
    success: true,
    run_id: runId,
    status: 'cancelled',
    cancelled_at: now,
    reason,
  };
}
