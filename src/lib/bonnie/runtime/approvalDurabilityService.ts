/**
 * Durable approvals with data-version revalidation.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { transitionTask } from './transitionService';
import { insertOutboxEvent } from './outboxService';
import { createHash } from 'crypto';

function fingerprint(action: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(action)).digest('hex').slice(0, 32);
}

export async function createApprovalForTask(params: {
  tenantId: string;
  taskId: string;
  runId: string;
  proposedAction: Record<string, unknown>;
  dataVersion: string;
  requiredRole?: string;
  expiresInMs?: number;
}) {
  const admin = createSupabaseAdminClient();
  const fp = fingerprint(params.proposedAction);
  const expires = new Date(Date.now() + (params.expiresInMs ?? 3 * 24 * 3600_000)).toISOString();

  // Bridge into existing approvals table when available
  let runnerApprovalId: string | null = null;
  try {
    const { data: runner } = await admin
      .from('autonomous_runner_approvals')
      .insert({
        tenant_id: params.tenantId,
        action_key: `bonnie:runtime:${params.taskId}`,
        risk_level: 'high',
        status: 'pending',
        reason: 'Durable runtime approval gate',
        payload: {
          source: 'bonnie_durable_runtime',
          task_id: params.taskId,
          run_id: params.runId,
          proposed_action: params.proposedAction,
          action_fingerprint: fp,
          data_version: params.dataVersion,
        },
        source: 'bonnie',
      })
      .select('id')
      .single();
    runnerApprovalId = runner?.id || null;
  } catch {
    // table may lack columns; continue with agent_approvals only
  }

  const { data, error } = await admin
    .from('agent_approvals')
    .insert({
      tenant_id: params.tenantId,
      task_id: params.taskId,
      run_id: params.runId,
      runner_approval_id: runnerApprovalId,
      proposed_action: params.proposedAction,
      action_fingerprint: fp,
      data_version: params.dataVersion,
      required_role: params.requiredRole || null,
      status: 'pending',
      expires_at: expires,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function decideApproval(params: {
  tenantId: string;
  approvalId: string;
  decision: 'approved' | 'rejected';
  decisionMaker: string;
  reason?: string;
  currentDataVersion?: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data: approval } = await admin
    .from('agent_approvals')
    .select('*')
    .eq('id', params.approvalId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();

  if (!approval || approval.status !== 'pending') {
    return { ok: false, error: 'not_pending' };
  }

  if (approval.expires_at && new Date(approval.expires_at).getTime() < Date.now()) {
    await admin
      .from('agent_approvals')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', approval.id);
    return { ok: false, error: 'expired' };
  }

  if (
    params.decision === 'approved' &&
    params.currentDataVersion &&
    params.currentDataVersion !== approval.data_version
  ) {
    await admin
      .from('agent_approvals')
      .update({
        status: 'invalidated',
        decision_reason: 'Underlying data changed; new approval required',
        updated_at: new Date().toISOString(),
      })
      .eq('id', approval.id);
    return { ok: false, error: 'data_version_mismatch', requiresNewApproval: true };
  }

  await admin
    .from('agent_approvals')
    .update({
      status: params.decision === 'approved' ? 'approved' : 'rejected',
      decision_maker: params.decisionMaker,
      decision_at: new Date().toISOString(),
      decision_reason: params.reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', approval.id);

  if (approval.runner_approval_id) {
    await admin
      .from('autonomous_runner_approvals')
      .update({ status: params.decision === 'approved' ? 'approved' : 'rejected' })
      .eq('id', approval.runner_approval_id);
  }

  if (params.decision === 'approved') {
    const { data: task } = await admin
      .from('agent_tasks')
      .select('id, version, run_id, correlation_id')
      .eq('id', approval.task_id)
      .maybeSingle();

    if (task) {
      await transitionTask({
        tenantId: params.tenantId,
        taskId: task.id,
        to: 'READY',
        trigger: 'approval_granted',
        actorType: 'user',
        actorId: params.decisionMaker,
        expectedVersion: task.version,
      });
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
  } else {
    await transitionTask({
      tenantId: params.tenantId,
      taskId: approval.task_id,
      to: 'CANCELLED',
      trigger: 'approval_rejected',
      actorType: 'user',
      actorId: params.decisionMaker,
      reason: params.reason || 'Rejected',
    });
  }

  return { ok: true };
}

export async function reconcileExpiredApprovals(limit = 40) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data } = await admin
    .from('agent_approvals')
    .select('id, tenant_id, task_id')
    .eq('status', 'pending')
    .lt('expires_at', now)
    .limit(limit);

  let n = 0;
  for (const row of data || []) {
    await admin
      .from('agent_approvals')
      .update({ status: 'expired', updated_at: now })
      .eq('id', row.id);
    await transitionTask({
      tenantId: row.tenant_id,
      taskId: row.task_id,
      to: 'FAILED',
      trigger: 'approval_expired',
      reason: 'Approval expired',
      patch: { failure_reason: 'Approval expired' },
    });
    n += 1;
  }
  return { expired: n };
}
