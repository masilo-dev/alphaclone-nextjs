import type { PolicySource } from '@/lib/ai/ToolPolicyGate';
import { sendEmailServer, type SendEmailServerParams, type SendEmailServerResult } from '@/lib/email/sendEmailServer';
import {
  assertEmailExecutionContext,
  buildTenantEmailIdempotencyKey,
} from '@/lib/email/emailExecutionContext';
import { executeDomainExternalWrite } from '@/lib/execution/domainExternalWrite';
import { guardDomainCapability } from '@/lib/execution/domainCapabilityGuard';
import { domainResultFromGateway, type DomainExecutionResult } from '@/lib/execution/domainExecutionResult';

export type SendEmailCommandParams = SendEmailServerParams & {
  executionSource: PolicySource | 'api' | 'worker' | 'cron';
  skipPolicyEvaluation?: boolean;
  policyArgs?: Record<string, unknown>;
};

export async function executeSendEmailCommand(
  params: SendEmailCommandParams
): Promise<DomainExecutionResult<SendEmailServerResult>> {
  const executionSource =
    params.executionSource === 'api' ? 'ui' : (params.executionSource as PolicySource);

  const sourceModule = String(params.auditMetadata?.source_module || params.initiationSource?.split('.')[0] || 'api');
  const sourceAction = String(params.auditMetadata?.source_action || params.initiationSource?.split('.').slice(1).join('.') || 'send');
  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  const resolvedIdempotencyKey =
    params.idempotencyKey?.trim() ||
    buildTenantEmailIdempotencyKey(assertEmailExecutionContext({ tenantId: params.tenantId, userId: params.userId, actorId: params.actorId }), {
      sourceModule,
      sourceAction,
      recipient: recipients,
      relatedEntityId: params.relatedRecord?.id,
      subject: params.subject,
      content: params.html || params.message || params.text || '',
      campaignId: params.campaignId,
      sequenceId: params.sequenceId,
      sequenceStepId: params.sequenceStepId,
      outreachAttemptId: params.outreachAttemptId,
    });

  const guard = await guardDomainCapability({
    tenantId: params.tenantId,
    userId: params.userId || params.actorId || 'system',
    capability: 'send_email',
    executionSource,
    args: {
      to: params.to,
      subject: params.subject,
      ...(params.policyArgs || {}),
    },
    idempotencyKey: resolvedIdempotencyKey,
    skipPolicyEvaluation: params.skipPolicyEvaluation,
  });

  if (!guard.allowed) {
    return {
      execution_id: '',
      status: guard.body.code === 'APPROVAL_REQUIRED' ? 'QUEUED' : 'FAILED',
      verification_state: guard.body.code === 'APPROVAL_REQUIRED' ? 'QUEUED' : 'FAILED',
      idempotency_key: resolvedIdempotencyKey,
      execution_source: String(executionSource),
      ok: false,
      approval_state: guard.body.approval_id ? 'queued' : guard.policy?.approvalState,
      failure_code: guard.body.code,
      error: { code: guard.body.code as 'POLICY_BLOCKED', message: guard.body.error },
    };
  }

  const idempotencyKey = resolvedIdempotencyKey;
  const gateway = await executeDomainExternalWrite({
    tenantId: params.tenantId,
    userId: params.userId || params.actorId || 'system',
    capability: 'send_email',
    action: 'email.send',
    mode: 'execute_now',
    executionSource,
    idempotencyKey,
    target: {
      workspace_id: params.tenantId,
      integration: params.preferredProvider || 'email',
      resource_type: 'email_message',
      resource_id: Array.isArray(params.to) ? params.to[0] : params.to,
    },
    payload: {
      subject: params.subject,
      to: params.to,
      initiationSource: params.initiationSource,
    },
    execute: async () =>
      sendEmailServer({
        ...params,
        idempotencyKey: idempotencyKey || params.idempotencyKey,
      }),
    isSuccess: (r) => r.success === true,
    mapError: (r) => ({
      code: r.code || 'EXECUTION_FAILED',
      message: r.error || 'Email send failed',
      details: r.errorDetails,
    }),
    buildReceipt: (r) => ({
      action_id: '',
      status: r.success ? 'verified' : 'failed',
      provider: r.provider,
      provider_reference: r.emailId || r.canonicalMessageId,
      timestamp: new Date().toISOString(),
      entity_type: 'email_message',
      entity_id: r.emailId || r.canonicalMessageId,
    }),
  });

  return domainResultFromGateway({
    executionSource: String(executionSource),
    gateway,
    approvalState: guard.policy?.approvalState,
  });
}
