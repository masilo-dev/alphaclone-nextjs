/**
 * Lease + claim helpers with fencing tokens.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { transitionTask } from './transitionService';
import { lookupIdempotency } from './idempotencyService';

export async function claimTask(params: {
  tenantId: string;
  taskId: string;
  workerId: string;
  leaseMs?: number;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('claim_agent_task', {
    p_task_id: params.taskId,
    p_tenant_id: params.tenantId,
    p_worker_id: params.workerId,
    p_lease_ms: params.leaseMs ?? 120_000,
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  const result = data as Record<string, unknown>;
  if (!result?.ok) {
    return { ok: false as const, error: String(result?.error || 'claim_failed'), ...result };
  }
  return {
    ok: true as const,
    taskId: String(result.taskId),
    attemptId: String(result.attemptId),
    attemptNumber: Number(result.attemptNumber),
    leaseToken: String(result.leaseToken),
    fencingToken: String(result.fencingToken),
    leaseExpiresAt: String(result.leaseExpiresAt),
    version: Number(result.version),
  };
}

export async function heartbeatLease(params: {
  tenantId: string;
  taskId: string;
  workerId: string;
  leaseToken: string;
  extendMs?: number;
}): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const expires = new Date(Date.now() + (params.extendMs ?? 120_000)).toISOString();
  const { data } = await admin
    .from('agent_tasks')
    .update({
      last_heartbeat_at: new Date().toISOString(),
      lease_expires_at: expires,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.taskId)
    .eq('tenant_id', params.tenantId)
    .eq('worker_id', params.workerId)
    .eq('lease_token', params.leaseToken)
    .in('status', ['CLAIMED', 'RUNNING'])
    .select('id')
    .maybeSingle();

  if (!data) return false;

  await admin
    .from('agent_worker_leases')
    .update({
      last_heartbeat_at: new Date().toISOString(),
      expires_at: expires,
    })
    .eq('task_id', params.taskId)
    .eq('lease_token', params.leaseToken)
    .eq('status', 'active');

  return true;
}

/**
 * Expire abandoned leases. Never blindly retry — check idempotency first.
 */
export async function reclaimExpiredLeases(limit = 30): Promise<{
  reclaimed: number;
  uncertain: number;
}> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: expired } = await admin
    .from('agent_tasks')
    .select('id, tenant_id, status, lease_token, worker_id, idempotency_key, version, attempt_count')
    .in('status', ['CLAIMED', 'RUNNING'])
    .lt('lease_expires_at', now)
    .order('lease_expires_at', { ascending: true })
    .limit(limit);

  let reclaimed = 0;
  let uncertain = 0;

  for (const task of expired || []) {
    await admin
      .from('agent_worker_leases')
      .update({ status: 'expired', released_at: now })
      .eq('task_id', task.id)
      .eq('lease_token', task.lease_token)
      .eq('status', 'active');

    await admin
      .from('agent_task_attempts')
      .update({
        status: 'abandoned',
        ended_at: now,
        error_category: 'lease_expired',
        error_message: 'Worker lease expired',
      })
      .eq('task_id', task.id)
      .eq('lease_token', task.lease_token)
      .eq('status', 'running');

    let safeToRequeue = true;
    if (task.idempotency_key) {
      const existing = await lookupIdempotency(task.tenant_id, task.idempotency_key);
      if (existing?.state === 'completed') {
        await transitionTask({
          tenantId: task.tenant_id,
          taskId: task.id,
          to: 'COMPLETED',
          trigger: 'lease_reclaim_idempotent_complete',
          actorType: 'reconciler',
          actorId: 'lease',
          reason: 'Idempotency key already completed',
          expectedVersion: task.version,
          patch: {
            structured_output: existing.result || {},
            worker_id: null,
            lease_token: null,
            lease_expires_at: null,
          },
        });
        reclaimed += 1;
        continue;
      }
      if (existing?.state === 'running' || existing?.state === 'uncertain') {
        safeToRequeue = false;
      }
    }

    if (!safeToRequeue) {
      await transitionTask({
        tenantId: task.tenant_id,
        taskId: task.id,
        to: 'EXECUTION_UNCERTAIN',
        trigger: 'lease_reclaim_uncertain',
        actorType: 'reconciler',
        actorId: 'lease',
        reason: 'Side effect may have completed; requires provider verification',
        expectedVersion: task.version,
        patch: { worker_id: null, lease_token: null, lease_expires_at: null },
      });
      uncertain += 1;
      continue;
    }

    await transitionTask({
      tenantId: task.tenant_id,
      taskId: task.id,
      to: 'READY',
      trigger: 'lease_reclaim',
      actorType: 'reconciler',
      actorId: 'lease',
      reason: 'Lease expired; safe to requeue',
      expectedVersion: task.version,
      patch: { worker_id: null, lease_token: null, lease_expires_at: null },
    });
    reclaimed += 1;
  }

  return { reclaimed, uncertain };
}
