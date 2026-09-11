/**
 * Route invoice send through Bonnie durable runtime when enabled, else Workflow SDK.
 */

import { isDurableRuntimeEnabled } from '@/lib/bonnie/runtime/types';
import { enqueueInvoiceSendTask } from '@/lib/invoices/durableInvoiceSendTask';
import { start } from 'workflow/api';
import { invoiceLifecycleWorkflow } from '@/workflows/invoice-lifecycle';
import type { InvoiceLifecycleInput } from '@/lib/invoices/invoiceLifecycleSteps';

export type QueueInvoiceSendInput = {
  tenantId: string;
  userId: string;
  invoiceId: string;
  recipients?: string[];
  subject?: string;
  message?: string;
  idempotencyKey?: string;
};

export type QueueInvoiceSendResult = {
  durable: boolean;
  status: 'queued';
  run_id: string;
  task_id?: string;
  workflow_run_id?: string;
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
  };

  if (isDurableRuntimeEnabled()) {
    const enqueued = await enqueueInvoiceSendTask({
      tenantId: input.tenantId,
      userId: input.userId,
      invoiceId: input.invoiceId,
      recipients: input.recipients,
      subject: input.subject,
      message: input.message,
      idempotencyKey: input.idempotencyKey || `invoice-send-${input.invoiceId}`,
    });
    return {
      durable: true,
      status: 'queued',
      run_id: enqueued.runId,
      task_id: enqueued.taskId,
      poll_tool: 'get_outcome_status',
    };
  }

  const { runId } = await start(invoiceLifecycleWorkflow, [lifecycleInput]);
  return {
    durable: false,
    status: 'queued',
    run_id: runId,
    workflow_run_id: runId,
    poll_tool: 'get_outcome_status',
  };
}
