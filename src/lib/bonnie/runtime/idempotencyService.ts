/**
 * Idempotency + external provider references.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildIdempotencyKey } from './utils';

export { buildIdempotencyKey };

export async function lookupIdempotency(tenantId: string, key: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('agent_idempotency_keys')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('idempotency_key', key)
    .maybeSingle();
  return data;
}

export async function beginIdempotentAction(params: {
  tenantId: string;
  key: string;
  taskId: string;
  attemptId?: string | null;
  actionType: string;
  fingerprint?: string;
}): Promise<{ proceed: boolean; existing?: Record<string, unknown> }> {
  const existing = await lookupIdempotency(params.tenantId, params.key);
  if (existing?.state === 'completed') {
    return { proceed: false, existing };
  }
  if (existing?.state === 'running') {
    return { proceed: false, existing };
  }

  const admin = createSupabaseAdminClient();
  if (!existing) {
    const { error } = await admin.from('agent_idempotency_keys').insert({
      tenant_id: params.tenantId,
      idempotency_key: params.key,
      task_id: params.taskId,
      attempt_id: params.attemptId || null,
      action_type: params.actionType,
      request_fingerprint: params.fingerprint || null,
      state: 'running',
    });
    if (error && /duplicate|unique/i.test(error.message)) {
      const again = await lookupIdempotency(params.tenantId, params.key);
      if (again?.state === 'completed') return { proceed: false, existing: again };
      if (again?.state === 'running') return { proceed: false, existing: again };
    } else if (error) {
      throw new Error(error.message);
    }
  } else {
    await admin
      .from('agent_idempotency_keys')
      .update({ state: 'running', started_at: new Date().toISOString() })
      .eq('id', existing.id);
  }

  return { proceed: true };
}

export async function completeIdempotentAction(params: {
  tenantId: string;
  key: string;
  result: Record<string, unknown>;
  providerReference?: string | null;
  uncertain?: boolean;
}) {
  const admin = createSupabaseAdminClient();
  await admin
    .from('agent_idempotency_keys')
    .update({
      state: params.uncertain ? 'uncertain' : 'completed',
      result: params.result,
      external_provider_reference: params.providerReference || null,
      completed_at: params.uncertain ? null : new Date().toISOString(),
    })
    .eq('tenant_id', params.tenantId)
    .eq('idempotency_key', params.key);
}

export async function saveExternalReference(params: {
  tenantId: string;
  taskId?: string | null;
  attemptId?: string | null;
  toolExecutionId?: string | null;
  provider: string;
  referenceType: string;
  referenceId: string;
  payload?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  await admin.from('agent_external_references').upsert(
    {
      tenant_id: params.tenantId,
      task_id: params.taskId || null,
      attempt_id: params.attemptId || null,
      tool_execution_id: params.toolExecutionId || null,
      provider: params.provider,
      reference_type: params.referenceType,
      reference_id: params.referenceId,
      payload: params.payload || {},
    },
    { onConflict: 'tenant_id,provider,reference_type,reference_id' }
  );
}

export async function recordToolExecution(params: {
  tenantId: string;
  taskId: string;
  attemptId?: string | null;
  toolName: string;
  idempotencyKey?: string | null;
  fencingToken?: string | null;
  args?: Record<string, unknown>;
  status: 'started' | 'completed' | 'failed' | 'uncertain' | 'skipped';
  result?: Record<string, unknown>;
  providerReference?: string | null;
  errorMessage?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('agent_tool_executions')
    .insert({
      tenant_id: params.tenantId,
      task_id: params.taskId,
      attempt_id: params.attemptId || null,
      tool_name: params.toolName,
      idempotency_key: params.idempotencyKey || null,
      fencing_token: params.fencingToken || null,
      status: params.status,
      args: params.args || {},
      result: params.result || {},
      provider_reference: params.providerReference || null,
      error_message: params.errorMessage || null,
      completed_at: params.status === 'started' ? null : new Date().toISOString(),
    })
    .select('id')
    .single();
  return data?.id as string | undefined;
}
