/**
 * Durable invoice send — initial PDF + email + sent transition on Bonnie worker.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createGraphTransactional } from '@/lib/bonnie/runtime/graphService';
import { createRunForObjective, getRunProgressSummary } from '@/lib/bonnie/runtime/goalRunService';
import { insertOutboxEvent } from '@/lib/bonnie/runtime/outboxService';
import { claimTask } from '@/lib/bonnie/runtime/leaseService';
import { transitionTask } from '@/lib/bonnie/runtime/transitionService';
import type { GraphTaskInput } from '@/lib/bonnie/runtime/types';
import {
  runInvoiceInitialSend,
  type InvoiceAttachmentItem,
  type InvoiceLifecycleInput,
} from '@/lib/invoices/invoiceLifecycleSteps';

export type EnqueueInvoiceSendInput = {
  tenantId: string;
  userId: string;
  invoiceId: string;
  recipients?: string[];
  subject?: string;
  message?: string;
  attachments?: InvoiceAttachmentItem[];
  idempotencyKey?: string;
};

function formatExecutionError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object') {
    const maybeMsg = (err as Record<string, unknown>).message;
    const maybeCode = (err as Record<string, unknown>).code;
    if (typeof maybeMsg === 'string' && maybeMsg.trim()) {
      return maybeCode ? `${maybeCode}: ${maybeMsg}` : maybeMsg;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return 'invoice_send_failed';
    }
  }
  return typeof err === 'string' && err.trim() ? err : 'invoice_send_failed';
}

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
      attachments: input.attachments || [],
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
    correlationId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)
      ? idempotencyKey
      : input.invoiceId,
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
    attachments: Array.isArray(input.attachments) ? (input.attachments as InvoiceAttachmentItem[]) : undefined,
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
        recipients: sent.recipients,
        action_url: sent.actionUrl,
        lifecycle_status: 'sent',
        canonical_delivery_status: 'provider_accepted',
        storage_path: sent.storagePath,
      },
    };
  } catch (err) {
    const errorMessage = formatExecutionError(err);
    try {
      const admin = createSupabaseAdminClient();
      const nowIso = new Date().toISOString();
      await admin
        .from('business_invoices')
        .update({
          canonical_delivery_status: 'failed',
          updated_at: nowIso,
        })
        .eq('tenant_id', lifecycleInput.tenantId)
        .eq('id', lifecycleInput.invoiceId);
    } catch {
      // Do not mask primary failure
    }
    return { ok: false, error: errorMessage };
  }
}

export async function executeEnqueuedInvoiceSendInline(params: {
  tenantId: string;
  runId: string;
  taskId: string;
}): Promise<{
  executed: boolean;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}> {
  const admin = createSupabaseAdminClient();
  const worker = `inline-invoice-dispatcher-${Date.now()}`;

  const claim = await claimTask({
    tenantId: params.tenantId,
    taskId: params.taskId,
    workerId: worker,
  });

  if (!claim.ok) {
    return { executed: false, ok: false, error: claim.error };
  }

  const { data: taskRow } = await admin
    .from('agent_tasks')
    .select('*')
    .eq('id', params.taskId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();

  if (!taskRow) {
    return { executed: false, ok: false, error: 'Task not found after claim' };
  }

  await transitionTask({
    tenantId: params.tenantId,
    taskId: params.taskId,
    to: 'RUNNING',
    trigger: 'inline_invoice_send_start',
    actorType: 'worker',
    actorId: worker,
    relatedAttemptId: claim.attemptId,
    expectedVersion: taskRow.version,
  });

  const outcome = await executeInvoiceSendDurableTask({
    tenantId: params.tenantId,
    task: taskRow as Record<string, unknown>,
  });

  const nowIso = new Date().toISOString();

  if (outcome.ok) {
    await admin
      .from('agent_task_attempts')
      .update({
        status: 'completed',
        ended_at: nowIso,
      })
      .eq('id', claim.attemptId);

    await transitionTask({
      tenantId: params.tenantId,
      taskId: params.taskId,
      to: 'COMPLETED',
      trigger: 'invoice_send_verified',
      actorType: 'worker',
      actorId: worker,
      relatedAttemptId: claim.attemptId,
      patch: {
        structured_output: outcome.result || {},
        worker_id: null,
        lease_token: null,
        lease_expires_at: null,
      },
    });

    await getRunProgressSummary(params.runId, params.tenantId).catch(() => undefined);
    return { executed: true, ok: true, result: outcome.result };
  }

  const errorMessage = outcome.error || 'invoice_send_failed';
  await admin
    .from('agent_task_attempts')
    .update({
      status: 'failed',
      ended_at: nowIso,
      error_category: 'execution_error',
      error_code: 'INVOICE_SEND_FAILED',
      error_message: errorMessage,
      retryable: false,
    })
    .eq('id', claim.attemptId);

  await transitionTask({
    tenantId: params.tenantId,
    taskId: params.taskId,
    to: 'FAILED',
    trigger: 'inline_invoice_send_failed',
    actorType: 'worker',
    actorId: worker,
    relatedAttemptId: claim.attemptId,
    reason: errorMessage,
    patch: {
      worker_id: null,
      lease_token: null,
      lease_expires_at: null,
      failure_reason: errorMessage,
    },
  });

  await getRunProgressSummary(params.runId, params.tenantId).catch(() => undefined);
  return { executed: true, ok: false, error: errorMessage };
}
