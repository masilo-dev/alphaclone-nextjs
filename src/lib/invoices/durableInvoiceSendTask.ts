/**
 * Durable invoice send — initial PDF + email + sent transition on Bonnie worker.
 */

import { createGraphTransactional } from '@/lib/bonnie/runtime/graphService';
import { createRunForObjective } from '@/lib/bonnie/runtime/goalRunService';
import { insertOutboxEvent } from '@/lib/bonnie/runtime/outboxService';
import type { GraphTaskInput } from '@/lib/bonnie/runtime/types';
import {
  runInvoiceInitialSend,
  type InvoiceLifecycleInput,
} from '@/lib/invoices/invoiceLifecycleSteps';

export type EnqueueInvoiceSendInput = {
  tenantId: string;
  userId: string;
  invoiceId: string;
  recipients?: string[];
  subject?: string;
  message?: string;
  idempotencyKey?: string;
};

export async function enqueueInvoiceSendTask(input: EnqueueInvoiceSendInput): Promise<{
  runId: string;
  taskId: string;
}> {
  const idempotencyKey =
    input.idempotencyKey || `invoice-send-${input.invoiceId}-${Date.now()}`;

  const runResult = await createRunForObjective({
    tenantId: input.tenantId,
    userId: input.userId,
    objective: `Send invoice ${input.invoiceId.slice(0, 8)}`,
    executionMode: 'autonomous',
    successCriteria: { requireInvoiceSent: true },
    seedGraph: false,
  });

  const task: GraphTaskInput = {
    tempId: 't_invoice_send',
    title: 'Send invoice (PDF + email)',
    taskType: 'invoice.send',
    assignedAgentId: 'billing',
    status: 'READY',
    riskLevel: 'high',
    structuredInput: {
      tenantId: input.tenantId,
      userId: input.userId,
      invoiceId: input.invoiceId,
      recipients: input.recipients || [],
      subject: input.subject || null,
      message: input.message || null,
      idempotencyKey,
    },
    idempotencyKey,
    retryPolicy: { maxAttempts: 3, backoffMs: 90_000 },
  };

  const graph = await createGraphTransactional({
    tenantId: input.tenantId,
    runId: runResult.run.id,
    tasks: [task],
    reason: 'invoice_send_enqueue',
    actorType: 'api',
    actorId: input.userId,
  });

  const taskId = graph.taskIds[0];
  if (!taskId) throw new Error('Failed to enqueue invoice send task');

  await insertOutboxEvent({
    tenantId: input.tenantId,
    eventType: 'invoice.send.enqueued',
    payload: { task_id: taskId, run_id: runResult.run.id, invoice_id: input.invoiceId },
    correlationId: idempotencyKey,
  });

  return { runId: runResult.run.id, taskId };
}

export async function executeInvoiceSendDurableTask(params: {
  tenantId: string;
  task: Record<string, unknown>;
}): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  const input = (params.task.structured_input || {}) as Record<string, unknown>;
  const lifecycleInput: InvoiceLifecycleInput = {
    invoiceId: String(input.invoiceId || ''),
    tenantId: String(input.tenantId || params.tenantId),
    actorUserId: String(input.userId || ''),
    recipients: Array.isArray(input.recipients) ? (input.recipients as string[]) : undefined,
    subject: typeof input.subject === 'string' ? input.subject : undefined,
    message: typeof input.message === 'string' ? input.message : undefined,
  };

  if (!lifecycleInput.invoiceId) {
    return { ok: false, error: 'missing_invoice_id' };
  }

  try {
    const sent = await runInvoiceInitialSend(lifecycleInput);
    return {
      ok: true,
      result: {
        invoice_id: lifecycleInput.invoiceId,
        provider: sent.provider,
        message_id: sent.emailId,
        lifecycle_status: 'sent',
        storage_path: sent.storagePath,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'invoice_send_failed' };
  }
}
