import type { PolicySource } from '@/lib/ai/ToolPolicyGate';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { executeDomainExternalWrite } from '@/lib/execution/domainExternalWrite';
import { guardDomainCapability } from '@/lib/execution/domainCapabilityGuard';
import { contractSendIdempotencyKey } from '@/lib/execution/domainIdempotencyKeys';
import { domainResultFromGateway, type DomainExecutionResult } from '@/lib/execution/domainExecutionResult';

export type ContractSendResult = {
  success: boolean;
  error?: string;
  signingUrl?: string;
  [key: string]: unknown;
};

export type ContractSendCommandParams = {
  tenantId: string;
  userId: string;
  contractId: string;
  recipients: string | string[];
  subject?: string;
  message?: string;
  resendForSignature?: boolean;
  version?: string | number;
  idempotencyKey?: string;
  executionSource: PolicySource | 'api' | 'worker' | 'cron';
  skipPolicyEvaluation?: boolean;
  config?: Record<string, unknown>;
};

function resolveSource(source: ContractSendCommandParams['executionSource']): PolicySource {
  if (source === 'api') return 'ui';
  if (source === 'worker') return 'cron';
  return source as PolicySource;
}

function firstRecipient(recipients: string | string[]): string {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  return String(list[0] || '').trim().toLowerCase();
}

export async function executeContractSendCommand(
  params: ContractSendCommandParams
): Promise<DomainExecutionResult<ContractSendResult>> {
  const executionSource = resolveSource(params.executionSource);
  const recipient = firstRecipient(params.recipients);
  const idempotencyKey =
    params.idempotencyKey?.trim() ||
    contractSendIdempotencyKey({
      tenantId: params.tenantId,
      contractId: params.contractId,
      recipient,
      version: params.version,
    });

  const guard = await guardDomainCapability({
    tenantId: params.tenantId,
    userId: params.userId,
    capability: 'send_contract',
    executionSource,
    args: {
      contract_id: params.contractId,
      recipients: params.recipients,
      resend: params.resendForSignature,
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

  const admin = createSupabaseAdminClient();
  const gateway = await executeDomainExternalWrite({
    tenantId: params.tenantId,
    userId: params.userId,
    capability: 'send_contract',
    action: 'contract.send',
    mode: 'execute_now',
    executionSource,
    idempotencyKey,
    target: {
      workspace_id: params.tenantId,
      resource_type: 'contract',
      resource_id: params.contractId,
    },
    payload: {
      contractId: params.contractId,
      recipients: params.recipients,
      resendForSignature: params.resendForSignature,
    },
    execute: async () => {
      const { sendContract } = await import('@/app/api/contracts/management/route');
      return sendContract(
        params.tenantId,
        {
          contractId: params.contractId,
          recipients: params.recipients,
          subject: params.subject,
          message: params.message,
          resendForSignature: params.resendForSignature,
          ...(params.config || {}),
          idempotencyKey,
        },
        admin,
        params.userId
      ) as Promise<ContractSendResult>;
    },
    isSuccess: (r) => r.success === true,
    mapError: (r) => ({
      code: String(r.code || 'EXECUTION_FAILED'),
      message: r.error || 'Contract send failed',
    }),
    buildReceipt: (r) => ({
      action_id: '',
      status: 'provider_accepted',
      timestamp: new Date().toISOString(),
      entity_type: 'contract',
      entity_id: params.contractId,
      provider: typeof r.provider === 'string' ? r.provider : undefined,
      provider_reference: typeof r.provider_message_id === 'string' ? r.provider_message_id : undefined,
    }),
  });

  return domainResultFromGateway({
    executionSource: String(executionSource),
    gateway,
    businessObject: { type: 'contract', id: params.contractId },
    approvalState: guard.policy?.approvalState,
  });
}
