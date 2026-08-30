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
import { startChaseForTask } from './chasingService';
import { verifyTaskSideEffect, verifyBusinessOutcome } from './verificationService';
import { runBonnieWithOpenAIAgents } from '@/lib/bonnie/bonnieOpenAIAgentsRunner';
import type { BonnieModuleId } from '@/lib/bonnie/bonnieToolCatalog';
import { createHash } from 'crypto';

function workerId() {
  return `bonnie-worker-${process.pid}-${Date.now()}`;
}

function moduleForTask(task: Record<string, any>): BonnieModuleId {
  const text = `${task.assigned_agent_id || ''} ${task.title || ''} ${JSON.stringify(task.structured_input || {})}`.toLowerCase();
  if (/contract|agreement|signature|renewal/.test(text)) return 'contracts';
  if (/document|file|ocr|vault/.test(text)) return 'general';
  if (/invoice|payment|finance|revenue|collection/.test(text)) return 'accounting';
  if (/campaign|outreach|lead|crm|email|whatsapp|sms/.test(text)) return 'crm';
  return 'general';
}

function taskInstruction(task: Record<string, any>): string {
  const input = task.structured_input || {};
  return [
    `Complete this durable background task: ${task.title}.`,
    `Task type: ${task.task_type || 'generic'}. Assigned specialist: ${task.assigned_agent_id || 'general'}.`,
    `Authoritative task input: ${JSON.stringify(input)}.`,
    'Use real workspace tools. Do not simulate or claim success from planning alone.',
    'For every write, read the affected record back and verify the requested state before reporting completion.',
  ].join('\n');
}

async function approvalState(tenantId: string, taskId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('agent_approvals')
    .select('id, status, data_version')
    .eq('tenant_id', tenantId)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
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
    const existingApproval = await approvalState(tenantId, task.id);
    if (existingApproval?.status === 'approved') {
      intermediate.approvalId = existingApproval.id;
      intermediate.approvalVerified = true;
    } else {
      if (existingApproval?.status === 'pending') {
        await transitionTask({
          tenantId,
          taskId: task.id,
          to: 'WAITING_FOR_APPROVAL',
          trigger: 'approval_still_pending',
          actorType: 'worker',
          actorId: worker,
          relatedAttemptId: attemptId,
          patch: { worker_id: null, lease_token: null, lease_expires_at: null },
        });
        return { status: 'WAITING_FOR_APPROVAL' as const };
      }
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
        const { data: run } = await admin
          .from('agent_runs')
          .select('user_id')
          .eq('tenant_id', tenantId)
          .eq('id', task.run_id)
          .maybeSingle();
        if (!run?.user_id) throw new Error('Durable task has no accountable user');

        const agentResult = await runBonnieWithOpenAIAgents({
          tenantId,
          userId: run.user_id,
          instruction: taskInstruction(task),
          moduleId: moduleForTask(task),
          workflowId: task.run_id,
          conversationId: `durable-task:${task.id}`,
          policyAlreadyApproved: Boolean(intermediate.approvalVerified),
        });
        if (agentResult.executionStatus === 'queued_for_approval') {
          throw new Error('Tool policy requested an additional approval');
        }
        if (agentResult.executionStatus !== 'executed') {
          throw new Error(`Agent execution was not verified: ${agentResult.response}`);
        }

        const successful = agentResult.toolResults.filter((result) => result.success && !result.approvalRequired);
        const requiresToolEvidence = ['specialist', 'communicate'].includes(String(task.task_type));
        if (requiresToolEvidence && successful.length === 0) {
          throw new Error('Specialist task produced no successful tool evidence');
        }

        const toolExecutionIds: string[] = [];
        for (const result of agentResult.toolResults) {
          const toolExecId = await recordToolExecution({
            tenantId,
            taskId: task.id,
            attemptId,
            toolName: result.tool,
            idempotencyKey: key,
            fencingToken,
            args: task.structured_input || {},
            status: result.success && !result.approvalRequired ? 'completed' : 'failed',
            result: { summary: result.summary, details: result.details || null },
            errorMessage: result.success ? null : result.summary,
          });
          if (!toolExecId) continue;
          toolExecutionIds.push(toolExecId);
          if (result.success && !result.approvalRequired) {
            const evidenceHash = createHash('sha256')
              .update(`${task.id}:${result.tool}:${result.summary}:${result.details || ''}`)
              .digest('hex');
            await saveExternalReference({
              tenantId,
              taskId: task.id,
              attemptId,
              toolExecutionId: toolExecId,
              provider: result.tool,
              referenceType: 'verified_tool_result',
              referenceId: evidenceHash,
              payload: { summary: result.summary, details: result.details || null },
            });
          }
        }

        const executionResult = {
          ok: true,
          response: agentResult.response,
          executionStatus: agentResult.executionStatus,
          toolExecutionIds,
          successfulToolCount: successful.length,
        };
        const providerRef = toolExecutionIds[0] || null;
        await completeIdempotentAction({
          tenantId,
          key,
          result: executionResult,
          providerReference: providerRef,
        });
        intermediate.result = executionResult;
      }
    }

    if (stage === 'persist_result') {
      intermediate.persistedAt = new Date().toISOString();
    }

    if (stage === 'verify') {
      const side = await verifyTaskSideEffect({ tenantId, taskId: task.id });
      const outcome = await verifyBusinessOutcome({
        tenantId,
        taskId: task.id,
        taskType: String(task.task_type || ''),
        structuredOutput: (intermediate.result || {}) as Record<string, unknown>,
      });
      intermediate.verified = side.ok && outcome.verified;
      intermediate.verifyDetail = outcome.verified ? outcome.detail : `${side.detail}; ${outcome.detail}`;
      intermediate.outcomeTier = outcome.tier;
      intermediate.verifiedAt = new Date().toISOString();
      if (['specialist', 'communicate', 'billing', 'publish'].includes(String(task.task_type)) && !intermediate.verified) {
        throw new Error(`Task verification failed: ${intermediate.verifyDetail}`);
      }
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

  // Monitor / chase tasks wait for durable events + bounded follow-up timers
  if (task.task_type === 'monitor') {
    const input = (task.structured_input || {}) as Record<string, unknown>;
    await startChaseForTask({
      tenantId,
      runId: task.run_id,
      taskId: task.id,
      policy: (input.chase as any) || undefined,
      entityType: input.invoiceId ? 'invoice' : undefined,
      entityId: input.invoiceId ? String(input.invoiceId) : undefined,
    });
    // Keep createEventSubscription path for non-chase monitors without chase policy
    if (!input.chase) {
      await createEventSubscription({
        tenantId,
        runId: task.run_id,
        waitingTaskId: task.id,
        eventType: 'invoice_paid',
        matchConditions: { objective: task.structured_input },
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
      });
    }
    await admin
      .from('agent_task_attempts')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        output: { ...intermediate, chasing: true },
      })
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
