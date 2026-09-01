/**
 * Durable email send tasks — enqueue MCP/API sends for Bonnie worker delivery.
 */

import { createRunForObjective } from '@/lib/bonnie/runtime/goalRunService';
import { createGraphTransactional } from '@/lib/bonnie/runtime/graphService';
import { insertOutboxEvent } from '@/lib/bonnie/runtime/outboxService';
import type { GraphTaskInput } from '@/lib/bonnie/runtime/types';

export type EnqueueEmailSendInput = {
  tenantId: string;
  userId: string;
  actionId?: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

export async function enqueueEmailSendTask(input: EnqueueEmailSendInput): Promise<{
  runId: string;
  taskId: string;
}> {
  const runResult = await createRunForObjective({
    tenantId: input.tenantId,
    userId: input.userId,
    objective: `Durable email send (${input.idempotencyKey.slice(0, 24)})`,
    executionMode: 'autonomous',
    successCriteria: { requireProviderMessageId: true },
    seedGraph: false,
  });

  const task: GraphTaskInput = {
    tempId: 't_email_send',
    title: 'Send outbound email',
    taskType: 'email.send',
    assignedAgentId: 'email',
    status: 'READY',
    riskLevel: 'high',
    structuredInput: {
      ...input.payload,
      tenantId: input.tenantId,
      userId: input.userId,
      actionId: input.actionId || null,
      idempotencyKey: input.idempotencyKey,
    },
    retryPolicy: { maxAttempts: 4, backoffMs: 60_000 },
  };

  const graph = await createGraphTransactional({
    tenantId: input.tenantId,
    runId: runResult.run.id,
    tasks: [task],
    reason: 'email_send_enqueue',
    actorType: 'mcp',
    actorId: input.userId,
  });

  const taskId = graph.taskIds[0];
  if (!taskId) throw new Error('Failed to enqueue email send task');

  await insertOutboxEvent({
    tenantId: input.tenantId,
    eventType: 'email.send.enqueued',
    payload: {
      task_id: taskId,
      run_id: runResult.run.id,
      idempotency_key: input.idempotencyKey,
    },
    correlationId: input.actionId,
  });

  return { runId: runResult.run.id, taskId };
}

export async function executeEmailSendDurableTask(params: {
  tenantId: string;
  task: Record<string, unknown>;
}): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  const input = (params.task.structured_input || {}) as Record<string, unknown>;
  const tenantId = String(input.tenantId || params.tenantId);
  const userId = String(input.userId || '');
  if (!userId) return { ok: false, error: 'missing_user_id' };

  const { sendEmailServer } = await import('@/lib/email/sendEmailServer');
  const result = await sendEmailServer({
    tenantId,
    userId,
    to: String(input.to || ''),
    subject: String(input.subject || ''),
    message: String(input.text || input.message || ''),
    idempotencyKey: String(input.idempotencyKey || ''),
    initiationSource: 'durable.email.send',
    preferredProvider: input.provider as any,
  });

  if (!result.success) {
    return { ok: false, error: result.error || result.code || 'email_send_failed' };
  }

  return {
    ok: true,
    result: {
      provider: result.provider,
      message_id: result.emailId,
      delivery_status: 'provider_accepted',
    },
  };
}
