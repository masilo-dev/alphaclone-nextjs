import {
  evaluateToolPolicy,
  type PolicyDecision,
  type PolicySource,
} from '@/lib/ai/ToolPolicyGate';
import { normalizeExecutionErrorCode } from '@/lib/execution/executionErrorTaxonomy';

const EXTERNAL_WRITE_IDEMPOTENCY_CAPABILITIES = new Set([
  'send_email',
  'reply_to_email',
  'microsoft_send_email',
  'gmail_send_email',
  'publish_social_post',
  'publish_post',
  'create_social_post',
  'schedule_social_post',
  'send_invoice',
  'create_invoice',
  'send_quote',
  'send_contract',
  'create_contract',
  'create_project',
  'promote_lead_candidate',
]);

export function capabilityRequiresIdempotencyKey(capability: string): boolean {
  const n = capability.toLowerCase();
  if (EXTERNAL_WRITE_IDEMPOTENCY_CAPABILITIES.has(n)) return true;
  if (/(^send_|^publish_|^create_invoice|^send_invoice|^create_project)/.test(n)) return true;
  return false;
}

export type DomainGuardDeny = {
  allowed: false;
  policy: PolicyDecision | null;
  httpStatus: number;
  body: {
    ok: false;
    code: string;
    error: string;
    approval_id?: string;
    execution_truth?: Record<string, unknown>;
    policy?: Record<string, unknown>;
  };
};

export type DomainGuardAllow = {
  allowed: true;
  policy: PolicyDecision | null;
};

export async function guardDomainCapability(params: {
  tenantId: string;
  userId: string;
  capability: string;
  executionSource: PolicySource;
  args?: Record<string, unknown>;
  idempotencyKey?: string | null;
  skipPolicyEvaluation?: boolean;
}): Promise<DomainGuardAllow | DomainGuardDeny> {
  let policy: PolicyDecision | null = null;

  if (!params.skipPolicyEvaluation) {
    policy = await evaluateToolPolicy({
      tenantId: params.tenantId,
      userId: params.userId,
      toolName: params.capability,
      source: params.executionSource,
      args: params.args || {},
    });

    if (policy.outcome === 'deny') {
      return {
        allowed: false,
        policy,
        httpStatus: 403,
        body: {
          ok: false,
          code: 'POLICY_BLOCKED',
          error: policy.reason,
          policy: { risk_class: policy.riskClass, attributes: policy.policyAttributes },
        },
      };
    }

    if (policy.outcome === 'queue_approval') {
      return {
        allowed: false,
        policy,
        httpStatus: 202,
        body: {
          ok: false,
          code: 'APPROVAL_REQUIRED',
          error: policy.reason,
          approval_id: policy.approvalId,
          execution_truth: {
            status: 'QUEUED',
            verification_state: 'QUEUED',
            approval_state: 'queued',
            may_claim_completed: false,
          },
        },
      };
    }
  }

  if (capabilityRequiresIdempotencyKey(params.capability)) {
    const key = (params.idempotencyKey || '').trim();
    if (!key) {
      return {
        allowed: false,
        policy,
        httpStatus: 422,
        body: {
          ok: false,
          code: 'IDEMPOTENCY_REQUIRED',
          error:
            'idempotencyKey (or Idempotency-Key header) is required for this external write. Reuse the same key when retrying after timeouts.',
        },
      };
    }
  }

  return { allowed: true, policy };
}

export function mapProviderCodeToHttpStatus(code: string | undefined): number {
  const normalized = normalizeExecutionErrorCode(code);
  switch (normalized) {
    case 'VALIDATION_FAILED':
    case 'CONFIG_MISSING':
    case 'IDENTITY_NOT_CONNECTED':
    case 'DESTINATION_MISMATCH':
      return 400;
    case 'POLICY_BLOCKED':
    case 'AUTHORIZATION_FAILED':
      return 403;
    case 'APPROVAL_REQUIRED':
      return 202;
    case 'DUPLICATE_ACTION':
      return 409;
    case 'PROVIDER_RATE_LIMIT':
      return 429;
    case 'DEPENDENCY_UNAVAILABLE':
    case 'PROVIDER_AUTH_EXPIRED':
      return 503;
    case 'UNKNOWN_EXECUTION_STATE':
    case 'EXECUTION_TIMEOUT':
      return 504;
    default:
      return 502;
  }
}
