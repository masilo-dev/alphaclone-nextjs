/**
 * Durable worker — claim, heartbeat, safe-stage execute, checkpoint, complete/retry.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { claimTask, heartbeatLease } from './leaseService';
import { transitionTask } from './transitionService';
import { saveCheckpoint, getLatestCheckpoint } from './checkpointService';
import {
  beginIdempotentAction,
  buildIdempotencyKey,
  completeIdempotentAction,
  recordToolExecution,
  saveExternalReference,
} from './idempotencyService';
import { insertOutboxEvent } from './outboxService';
import { createApprovalForTask } from './approvalDurabilityService';
import { createEventSubscription } from './subscriptionService';
import { scheduleReadyTasks } from './schedulerService';
import { getRunProgressSummary } from './goalRunService';
import { classifyError, backoffWithJitter } from './utils';
import { openIntervention } from './interventionService';

function workerId() {
  return `bonnie-worker-${process.pid}-${Date.now()}`;
}

async function executeTaskStages(params: {
  tenantId: string;
  task: Record<string, any>;
  attemptId: string;
  fencingToken: string;
  leaseToken: string;
  worker: string;
}) {
  const admin = createSupabaseAdminClient();
  const { task, attemptId, fencingToken, leaseToken, worker, tenantId } = params;

  const { data: claimedRow } = await admin
    .from('agent_tasks')
    .select('version, status')
    .eq('id', task.id)
    .single();

  const running = await transitionTask({
    tenantId,
    taskId: task.id,
    to: 'RUNNING',
    trigger: 'worker_start',
    actorType: 'worker',
    actorId: worker,
    relatedAttemptId: attemptId,
    expectedVersion: claimedRow?.version,
  });
  if (!running.ok) {
    throw new Error(running.error || 'failed_to_enter_running');
  }

  await heartbeatLease({
    tenantId,
    taskId: task.id,
    workerId: worker,
    leaseToken,
  });

  const checkpoint = await getLatestCheckpoint(task.id, tenantId);
  const startStage = checkpoint?.completed_stage || 'start';
  const stages = ['load_context', 'execute_work', 'persist_result', 'verify'];
  const startIdx = Math.max(0, stages.indexOf(startStage) + (startStage === 'start' ? 0 : 1));

  const intermediate: Record<string, unknown> = {
    ...(checkpoint?.intermediate_output || {}),
    agentId: task.assigned_agent_id,
    taskType: task.task_type,
  };

  // Approval gate for high/critical before side effects
  if (
    (task.risk_level === 'high' ||
      task.risk_level === 'critical' ||
      Boolean((task.approval_policy as any)?.required)) &&
    startStage === 'start'
  ) {
    await createApprovalForTask({
      tenantId,
      taskId: task.id,
      runId: task.run_id,
      proposedAction: {
        title: task.title,
        agent: task.assigned_agent_id,
        input: task.structured_input,
      },
      dataVersion: String(task.version),
    });
    await transitionTask({
      tenantId,
      taskId: task.id,
      to: 'WAITING_FOR_APPROVAL',
      trigger: 'approval_required',
      actorType: 'worker',
      actorId: worker,
      relatedAttemptId: attemptId,
      patch: { worker_id: null, lease_token: null, lease_expires_at: null },
    });
    await admin
      .from('agent_task_attempts')
      .update({ status: 'completed', ended_at: new Date().toISOString(), output: { waiting: 'approval' } })
      .eq('id', attemptId);
    return { status: 'WAITING_FOR_APPROVAL' as const };
  }

  for (let i = startIdx; i < stages.length; i++) {
    const stage = stages[i];
    await heartbeatLease({ tenantId, taskId: task.id, workerId: worker, leaseToken });

    if (stage === 'load_context') {
      intermediate.loadedAt = new Date().toISOString();
      intermediate.input = task.structured_input;
    }

    if (stage === 'execute_work') {
      const actionType = `agent.${task.task_type || 'generic'}`;
      const key =
        task.idempotency_key ||
        buildIdempotencyKey({
          tenantId,
          taskId: task.id,
          actionType,
          targetRecordId: String((task.structured_input as any)?.targetId || task.id),
          actionVersion: task.attempt_count,
        });

      const gate = await beginIdempotentAction({
        tenantId,
        key,
        taskId: task.id,
        attemptId,
        actionType,
      });

      if (!gate.proceed && gate.existing?.state === 'completed') {
        intermediate.result = gate.existing.result;
        intermediate.idempotentReplay = true;
      } else if (!gate.proceed && (gate.existing?.state === 'running' || gate.existing?.state === 'uncertain')) {
        await transitionTask({
          tenantId,
          taskId: task.id,
          to: 'EXECUTION_UNCERTAIN',
          trigger: 'ambiguous_side_effect',
          actorType: 'worker',
          actorId: worker,
          relatedAttemptId: attemptId,
          patch: { worker_id: null, lease_token: null, lease_expires_at: null },
        });
        await admin
          .from('agent_task_attempts')
          .update({
            status: 'uncertain',
            ended_at: new Date().toISOString(),
            error_category: 'uncertain',
            error_message: 'Prior attempt may still be running',
          })
          .eq('id', attemptId);
        return { status: 'EXECUTION_UNCERTAIN' as const };
      } else {
        // Safe simulated specialist work (no external side effects in foundation worker).
        // Real tool calls go through recordToolExecution + policy in later hardening.
        const toolExecId = await recordToolExecution({
          tenantId,
          taskId: task.id,
          attemptId,
          toolName: `runtime.${task.task_type}`,
          idempotencyKey: key,
          fencingToken,
          args: task.structured_input || {},
          status: 'completed',
          result: {
            ok: true,
            summary: `Completed ${task.title}`,
            agent: task.assigned_agent_id,
          },
        });

        const providerRef = `sim_${task.id}_${attemptId}`;
        await saveExternalReference({
          tenantId,
          taskId: task.id,
          attemptId,
          toolExecutionId: toolExecId,
          provider: 'bonnie_runtime',
          referenceType: 'simulation',
          referenceId: providerRef,
        });

        await completeIdempotentAction({
          tenantId,
          key,
          result: { ok: true, providerRef },
          providerReference: providerRef,
        });

        intermediate.result = { ok: true, providerRef, toolExecId };
      }
    }

    if (stage === 'persist_result') {
      intermediate.persistedAt = new Date().toISOString();
    }

    if (stage === 'verify') {
      intermediate.verified = true;
      intermediate.verifiedAt = new Date().toISOString();
    }

    await saveCheckpoint({
      tenantId,
      taskId: task.id,
      attemptId,
      completedStage: stage,
      intermediateOutput: intermediate,
      remainingWork: { nextStages: stages.slice(i + 1) },
      cursorState: { stageIndex: i },
    });
  }

  // Monitor tasks wait for events instead of completing immediately
  if (task.task_type === 'monitor') {
    await createEventSubscription({
      tenantId,
      runId: task.run_id,
      waitingTaskId: task.id,
      eventType: 'invoice_paid',
      matchConditions: { objective: task.structured_input },
      expiresAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
    });
    await transitionTask({
      tenantId,
      taskId: task.id,
      to: 'WAITING_FOR_EVENT',
      trigger: 'await_external',
      actorType: 'worker',
      actorId: worker,
      relatedAttemptId: attemptId,
      patch: {
        structured_output: intermediate,
        worker_id: null,
        lease_token: null,
        lease_expires_at: null,
      },
    });
    await admin
      .from('agent_task_attempts')
      .update({ status: 'completed', ended_at: new Date().toISOString(), output: intermediate })
      .eq('id', attemptId);
    return { status: 'WAITING_FOR_EVENT' as const };
  }

  await transitionTask({
    tenantId,
    taskId: task.id,
    to: 'COMPLETED',
    trigger: 'worker_complete',
    actorType: 'worker',
    actorId: worker,
    relatedAttemptId: attemptId,
    patch: {
      structured_output: intermediate,
      worker_id: null,
      lease_token: null,
      lease_expires_at: null,
    },
  });

  await admin
    .from('agent_task_attempts')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      output: intermediate,
    })
    .eq('id', attemptId);

  return { status: 'COMPLETED' as const };
}

export async function processClaimableTasks(limit = 10): Promise<{
  processed: number;
  completed: number;
  waiting: number;
  failed: number;
}> {
  const admin = createSupabaseAdminClient();
  const worker = workerId();

  await scheduleReadyTasks({ limit: 40 });

  const { data: candidates } = await admin
    .from('agent_tasks')
    .select('*')
    .in('status', ['READY', 'QUEUED'])
    .or('scheduled_at.is.null,scheduled_at.lte.' + new Date().toISOString())
    .order('priority', { ascending: true })
    .order('updated_at', { ascending: true })
    .limit(limit);

  let processed = 0;
  let completed = 0;
  let waiting = 0;
  let failed = 0;

  for (const task of candidates || []) {
    const claim = await claimTask({
      tenantId: task.tenant_id,
      taskId: task.id,
      workerId: worker,
    });
    if (!claim.ok) continue;
    processed += 1;

    try {
      const result = await executeTaskStages({
        tenantId: task.tenant_id,
        task: { ...task, version: claim.version! - 1 },
        attemptId: claim.attemptId!,
        fencingToken: claim.fencingToken!,
        leaseToken: claim.leaseToken!,
        worker,
      });

      if (result.status === 'COMPLETED') completed += 1;
      else waiting += 1;

      await scheduleReadyTasks({ tenantId: task.tenant_id, runId: task.run_id, limit: 20 });
      await getRunProgressSummary(task.run_id, task.tenant_id);
    } catch (err: unknown) {
      const classified = classifyError(err);
      const attemptNumber = claim.attemptNumber || task.attempt_count + 1;

      await admin
        .from('agent_task_attempts')
        .update({
          status: classified.code === 'UNCERTAIN' ? 'uncertain' : 'failed',
          ended_at: new Date().toISOString(),
          error_category: classified.category,
          error_code: classified.code,
          error_message: classified.message,
          retryable: classified.retryable,
          next_retry_at: classified.retryable
            ? new Date(Date.now() + backoffWithJitter(attemptNumber)).toISOString()
            : null,
        })
        .eq('id', claim.attemptId);

      if (classified.code === 'UNCERTAIN') {
        await transitionTask({
          tenantId: task.tenant_id,
          taskId: task.id,
          to: 'EXECUTION_UNCERTAIN',
          trigger: 'worker_uncertain',
          relatedAttemptId: claim.attemptId,
          reason: classified.message,
          patch: { worker_id: null, lease_token: null, lease_expires_at: null, failure_reason: classified.message },
        });
        await openIntervention({
          tenantId: task.tenant_id,
          runId: task.run_id,
          taskId: task.id,
          category: 'execution_uncertain',
          title: `Uncertain execution: ${task.title}`,
          detail: classified.message,
        });
        failed += 1;
        continue;
      }

      if (classified.retryable && attemptNumber < (task.max_attempts || 3)) {
        const nextRetry = new Date(Date.now() + backoffWithJitter(attemptNumber)).toISOString();
        await transitionTask({
          tenantId: task.tenant_id,
          taskId: task.id,
          to: 'RETRY_SCHEDULED',
          trigger: 'worker_retry',
          relatedAttemptId: claim.attemptId,
          reason: classified.message,
          patch: {
            scheduled_at: nextRetry,
            worker_id: null,
            lease_token: null,
            lease_expires_at: null,
            failure_reason: classified.message,
          },
        });
        await insertOutboxEvent({
          tenantId: task.tenant_id,
          eventType: 'task.retry_scheduled',
          payload: {
            task_id: task.id,
            run_id: task.run_id,
            tenant_id: task.tenant_id,
            correlation_id: task.correlation_id,
          },
        });
      } else {
        await transitionTask({
          tenantId: task.tenant_id,
          taskId: task.id,
          to: 'FAILED',
          trigger: 'worker_failed',
          relatedAttemptId: claim.attemptId,
          reason: classified.message,
          patch: {
            worker_id: null,
            lease_token: null,
            lease_expires_at: null,
            failure_reason: classified.message,
          },
        });
        await openIntervention({
          tenantId: task.tenant_id,
          runId: task.run_id,
          taskId: task.id,
          category: 'retry_limit_reached',
          title: `Failed: ${task.title}`,
          detail: classified.message,
          suggestedResolution: 'Retry, edit inputs, or take over manually',
        });
      }
      failed += 1;
    }
  }

  return { processed, completed, waiting, failed };
}
