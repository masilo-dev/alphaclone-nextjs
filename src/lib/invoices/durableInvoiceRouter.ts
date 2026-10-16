/**
 * Route invoice send through Bonnie durable runtime when enabled, else Workflow SDK.
 */

import { isDurableRuntimeEnabled } from '@/lib/bonnie/runtime/types';
import {
  enqueueInvoiceSendTask,
  executeEnqueuedInvoiceSendInline,
} from '@/lib/invoices/durableInvoiceSendTask';
import { start } from 'workflow/api';
import { invoiceLifecycleWorkflow } from '@/workflows/invoice-lifecycle';
import type {
  InvoiceAttachmentItem,
  InvoiceLifecycleInput,
} from '@/lib/invoices/invoiceLifecycleSteps';

export type QueueInvoiceSendInput = {
  tenantId: string;
  userId: string;
  invoiceId: string;
  recipients?: string[];
  subject?: string;
  message?: string;
  attachments?: InvoiceAttachmentItem[];
  idempotencyKey?: string;
};

export type QueueInvoiceSendResult = {
  durable: boolean;
  status: 'sent' | 'queued';
  canonical_delivery_status: 'provider_accepted' | 'queued';
  run_id: string;
  task_id?: string;
  workflow_run_id?: string;
  provider?: string | null;
  email_id?: string | null;
  recipients?: string[];
  action_url?: string;
  storage_path?: string;
  poll_tool: string;
};

export async function queueInvoiceSend(input: QueueInvoiceSendInput): Promise<QueueInvoiceSendResult> {
  const lifecycleInput: InvoiceLifecycleInput = {
    invoiceId: input.invoiceId,
    tenantId: input.tenantId,
    actorUserId: input.userId,
    recipients: input.recipients,
    subject: input.subject,
    message: input.message,
    attachments: input.attachments,
  };

  const enqueueAndRunDurable = async (): Promise<QueueInvoiceSendResult> => {
    const enqueued = await enqueueInvoiceSendTask({
      tenantId: input.tenantId,
      userId: input.userId,
      invoiceId: input.invoiceId,
      recipients: input.recipients,
      subject: input.subject,
      message: input.message,
      attachments: input.attachments,
      idempotencyKey: input.idempotencyKey || `invoice-send-${input.invoiceId}-${Date.now()}`,
    });

    const inline = await executeEnqueuedInvoiceSendInline({
      tenantId: input.tenantId,
      runId: enqueued.runId,
      taskId: enqueued.taskId,
    });

    if (inline.executed) {
      if (!inline.ok) {
        throw new Error(inline.error || 'Invoice email dispatch failed');
      }
      const res = (inline.result || {}) as Record<string, unknown>;
      return {
        durable: true,
        status: 'sent',
        canonical_delivery_status: 'provider_accepted',
        run_id: enqueued.runId,
        task_id: enqueued.taskId,
        provider: (res.provider as string | null) ?? null,
        email_id: (res.message_id as string | null) ?? null,
        recipients: Array.isArray(res.recipients) ? (res.recipients as string[]) : input.recipients,
        action_url: typeof res.action_url === 'string' ? res.action_url : undefined,
        storage_path: typeof res.storage_path === 'string' ? res.storage_path : undefined,
        poll_tool: 'get_outcome_status',
      };
    }

    return {
      durable: true,
      status: 'queued',
      canonical_delivery_status: 'queued',
      run_id: enqueued.runId,
      task_id: enqueued.taskId,
      poll_tool: 'get_outcome_status',
    };
  };

  if (isDurableRuntimeEnabled()) {
    return enqueueAndRunDurable();
  }

  try {
    const { runId } = await start(invoiceLifecycleWorkflow, [lifecycleInput]);
    return {
      durable: false,
      status: 'queued',
      canonical_delivery_status: 'queued',
      run_id: runId,
      workflow_run_id: runId,
      poll_tool: 'get_outcome_status',
    };
  } catch (err: any) {
    console.warn('[queueInvoiceSend] Workflow SDK start failed, falling back to durable task:', err?.message || err);
    return enqueueAndRunDurable();
  }
}
