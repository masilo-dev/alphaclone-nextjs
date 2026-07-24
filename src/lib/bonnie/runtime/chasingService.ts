/**
 * Autonomous chasing policies — bounded follow-ups with stop conditions.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createTimer } from './timerService';
import { createEventSubscription } from './subscriptionService';
import { chasingPolicySchema, type ChasingPolicy } from './schemas';
import { transitionTask } from './transitionService';
import { insertOutboxEvent } from './outboxService';

export const DEFAULT_INVOICE_CHASE_POLICY: ChasingPolicy = chasingPolicySchema.parse({
  targetType: 'unpaid_invoice',
  terminalOutcomes: ['PAID', 'DISPUTED', 'PAYMENT_PLAN_AGREED', 'ESCALATED', 'CANCELLED'],
  followUpIntervalHours: 72,
  maxAttempts: 5,
  channel: 'email',
  requireApproval: true,
  escalationAfterAttempts: 3,
  respectWorkingHours: true,
  respectOptOut: true,
  stopOn: ['PAID', 'DISPUTED', 'CANCELLED', 'OPTED_OUT'],
});

export async function startChaseForTask(params: {
  tenantId: string;
  runId: string;
  taskId: string;
  policy?: Partial<ChasingPolicy>;
  entityType?: string;
  entityId?: string;
}) {
  const policy = chasingPolicySchema.parse({
    ...DEFAULT_INVOICE_CHASE_POLICY,
    ...(params.policy || {}),
  });

  const admin = createSupabaseAdminClient();
  await admin
    .from('agent_tasks')
    .update({
      metadata: {
        chasing: {
          policy,
          attempt: 1,
          startedAt: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.taskId)
    .eq('tenant_id', params.tenantId);

  // Wait for payment / reply events
  const eventTypes =
    policy.targetType === 'unpaid_invoice'
      ? ['invoice_paid', 'email_received', 'payment_failed']
      : ['email_received'];

  for (const eventType of eventTypes) {
    await createEventSubscription({
      tenantId: params.tenantId,
      runId: params.runId,
      waitingTaskId: params.taskId,
      eventType,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
      matchConditions: { chasing: true, policy: policy.targetType },
      expiresAt: new Date(
        Date.now() + policy.followUpIntervalHours * policy.maxAttempts * 3600_000
      ).toISOString(),
      timeoutBehavior: { action: 'ready', reason: 'chase_follow_up' },
    });
  }

  await createTimer({
    tenantId: params.tenantId,
    taskId: params.taskId,
    runId: params.runId,
    executeAt: new Date(Date.now() + policy.followUpIntervalHours * 3600_000).toISOString(),
    timerType: 'escalation',
    payload: { chase: true, attempt: 1 },
  });

  await transitionTask({
    tenantId: params.tenantId,
    taskId: params.taskId,
    to: 'WAITING_FOR_EVENT',
    trigger: 'chase_start',
    reason: `Chasing ${policy.targetType} for up to ${policy.maxAttempts} attempts`,
    patch: { worker_id: null, lease_token: null, lease_expires_at: null },
  });

  return { policy };
}

export async function advanceChaseAfterTimeout(params: {
  tenantId: string;
  taskId: string;
}): Promise<{ continue: boolean; escalated: boolean }> {
  const admin = createSupabaseAdminClient();
  const { data: task } = await admin
    .from('agent_tasks')
    .select('id, run_id, metadata, version, tenant_id')
    .eq('id', params.taskId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();

  if (!task) return { continue: false, escalated: false };
  const chasing = (task.metadata as any)?.chasing;
  if (!chasing?.policy) return { continue: false, escalated: false };

  const policy = chasingPolicySchema.parse(chasing.policy);
  const attempt = Number(chasing.attempt || 1) + 1;

  if (attempt > policy.maxAttempts) {
    await transitionTask({
      tenantId: params.tenantId,
      taskId: params.taskId,
      to: 'COMPLETED',
      trigger: 'chase_exhausted',
      reason: 'Max chase attempts reached — escalated/unresolved',
      expectedVersion: task.version,
      patch: {
        structured_output: { terminalOutcome: 'ESCALATED', attempts: attempt - 1 },
        metadata: { ...((task.metadata as object) || {}), chasing: { ...chasing, attempt, terminal: 'ESCALATED' } },
      },
    });
    return { continue: false, escalated: true };
  }

  const escalated = attempt >= policy.escalationAfterAttempts;
  await admin
    .from('agent_tasks')
    .update({
      metadata: {
        ...(task.metadata || {}),
        chasing: { ...chasing, attempt, escalated },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', task.id);

  await transitionTask({
    tenantId: params.tenantId,
    taskId: task.id,
    to: 'READY',
    trigger: 'chase_follow_up',
    reason: escalated ? 'Escalate follow-up' : 'Scheduled chase follow-up',
    expectedVersion: task.version,
  });

  await insertOutboxEvent({
    tenantId: params.tenantId,
    eventType: 'task.ready',
    payload: {
      task_id: task.id,
      run_id: task.run_id,
      tenant_id: params.tenantId,
    },
  });

  await createTimer({
    tenantId: params.tenantId,
    taskId: task.id,
    runId: task.run_id,
    executeAt: new Date(Date.now() + policy.followUpIntervalHours * 3600_000).toISOString(),
    timerType: 'escalation',
    payload: { chase: true, attempt },
  });

  return { continue: true, escalated };
}

export function shouldStopChase(terminalSignal: string, policy: ChasingPolicy): boolean {
  return policy.stopOn.map((s) => s.toUpperCase()).includes(terminalSignal.toUpperCase());
}
