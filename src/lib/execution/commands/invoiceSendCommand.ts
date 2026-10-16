import type { PolicySource } from '@/lib/ai/ToolPolicyGate';
import { queueInvoiceSend, type QueueInvoiceSendResult } from '@/lib/invoices/durableInvoiceRouter';
import type { InvoiceAttachmentItem } from '@/lib/invoices/invoiceLifecycleSteps';
import { executeDomainExternalWrite } from '@/lib/execution/domainExternalWrite';
import { guardDomainCapability } from '@/lib/execution/domainCapabilityGuard';
import { invoiceSendIdempotencyKey } from '@/lib/execution/domainIdempotencyKeys';
import { domainResultFromGateway, type DomainExecutionResult } from '@/lib/execution/domainExecutionResult';

export type InvoiceSendCommandParams = {
  tenantId: string;
  userId: string;
  invoiceId: string;
  recipients: string[];
  subject?: string;
  message?: string;
  attachments?: InvoiceAttachmentItem[];
  attemptId?: string;
  idempotencyKey?: string;
  executionSource: PolicySource | 'api' | 'worker' | 'cron';
  skipPolicyEvaluation?: boolean;
};

export async function executeInvoiceSendCommand(
  params: InvoiceSendCommandParams
): Promise<DomainExecutionResult<QueueInvoiceSendResult>> {
  const executionSource =
    params.executionSource === 'api' ? 'ui' : (params.executionSource as PolicySource);
  const idempotencyKey =
    params.idempotencyKey?.trim() ||
    invoiceSendIdempotencyKey({
      tenantId: params.tenantId,
      invoiceId: params.invoiceId,
      recipients: params.recipients,
      attemptId: params.attemptId,
    });

  const guard = await guardDomainCapability({
    tenantId: params.tenantId,
    userId: params.userId,
    capability: 'send_invoice',
    executionSource,
    args: {
      invoice_id: params.invoiceId,
      recipients: params.recipients,
    },
    idempotencyKey,
    skipPolicyEvaluation: params.skipPolicyEvaluation,
  });

  if (!guard.allowed) {
    return {
      execution_id: '',
      status: guard.body.code === 'APPROVAL_REQUIRED' ? 'QUEUED' : 'FAILED',
      verification_state: guard.body.code === 'APPROVAL_REQUIRED' ? 'QUEUED' : 'FAILED',
      idempotency_key: idempotencyKey,
      execution_source: String(executionSource),
      ok: false,
      failure_code: guard.body.code,
      error: { code: guard.body.code as 'POLICY_BLOCKED', message: guard.body.error },
    };
  }

  const gateway = await executeDomainExternalWrite({
    tenantId: params.tenantId,
    userId: params.userId,
    capability: 'send_invoice',
    action: 'invoice.send',
    mode: 'execute_now',
    executionSource,
    idempotencyKey,
    target: {
      workspace_id: params.tenantId,
      resource_type: 'invoice',
      resource_id: params.invoiceId,
    },
    payload: {
      invoiceId: params.invoiceId,
      recipients: params.recipients,
      attachmentsCount: params.attachments?.length || 0,
    },
    execute: async () =>
      queueInvoiceSend({
        tenantId: params.tenantId,
        userId: params.userId,
        invoiceId: params.invoiceId,
        recipients: params.recipients,
        subject: params.subject,
        message: params.message,
        attachments: params.attachments,
        idempotencyKey,
      }),
    isSuccess: (r) => r.status === 'sent' || r.status === 'queued',
    buildReceipt: (r) => ({
      action_id: '',
      status: r.status === 'sent' ? 'succeeded' : 'queued',
      timestamp: new Date().toISOString(),
      entity_type: 'invoice',
      entity_id: params.invoiceId,
      provider: r.provider || undefined,
      provider_reference: r.email_id || r.run_id,
      live_url: r.action_url || undefined,
    }),
  });

  return domainResultFromGateway({
    executionSource: String(executionSource),
    gateway,
    businessObject: { type: 'invoice', id: params.invoiceId },
    approvalState: guard.policy?.approvalState,
  });
}
