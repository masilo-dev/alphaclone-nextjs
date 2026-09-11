import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type WorkflowStatus = 'in_progress' | 'completed' | 'failed' | 'paused';

export async function getResumableWorkflowRun(
  tenantId: string,
  workflowId: string,
  idempotencyKey?: string
) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from('workflow_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('workflow_id', workflowId)
    .in('status', ['in_progress', 'failed'])
    .order('updated_at', { ascending: false })
    .limit(1);

  if (idempotencyKey) {
    query = query.eq('idempotency_key', idempotencyKey);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn('[workflowRuns] getResumableWorkflowRun failed:', error.message);
    return null;
  }
  return data;
}

export async function startWorkflowRun(params: {
  tenantId: string;
  userId?: string | null;
  workflowId: string;
  idempotencyKey?: string;
  currentStep?: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();

  if (params.idempotencyKey) {
    const existing = await getResumableWorkflowRun(
      params.tenantId,
      params.workflowId,
      params.idempotencyKey
    );
    if (existing) return existing;
  }

  const { data, error } = await admin
    .from('workflow_runs')
    .insert({
      tenant_id: params.tenantId,
      user_id: params.userId || null,
      workflow_id: params.workflowId,
      idempotency_key: params.idempotencyKey || null,
      current_step: params.currentStep || 'start',
      status: 'in_progress',
      metadata: params.metadata || {},
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function recordWorkflowStep(
  runId: string,
  step: string,
  status: 'ok' | 'error',
  details?: Record<string, unknown>
) {
  const admin = createSupabaseAdminClient();
  const { data: existing, error: readErr } = await admin
    .from('workflow_runs')
    .select('step_history')
    .eq('id', runId)
    .single();

  if (readErr || !existing) return;

  const history = Array.isArray(existing.step_history) ? [...existing.step_history] : [];
  history.push({
    step,
    status,
    at: new Date().toISOString(),
    ...(details || {}),
  });

  await admin
    .from('workflow_runs')
    .update({
      current_step: step,
      step_history: history,
      updated_at: new Date().toISOString(),
      last_error: status === 'error' ? String(details?.error || 'step failed') : null,
      status: status === 'error' ? 'failed' : 'in_progress',
    })
    .eq('id', runId);
}

export async function completeWorkflowRun(runId: string, metadata?: Record<string, unknown>) {
  const admin = createSupabaseAdminClient();
  await admin
    .from('workflow_runs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: metadata || {},
    })
    .eq('id', runId);
}
