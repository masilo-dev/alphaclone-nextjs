import type { ActionReceipt } from '@/lib/mcp/connector/types';
import type { ExecutionState, CanonicalExecutionState } from '@/lib/execution/executionStates';
import { normalizeExecutionState, normalizeCanonicalExecutionState } from '@/lib/execution/executionStates';
import type { NormalizedExecutionError } from '@/lib/execution/executionErrorTaxonomy';

/** Source-neutral execution truth — adapters map this for MCP, UI, Bonnie, and API JSON. */
export type DomainExecutionResult<TResult = unknown> = {
  execution_id: string;
  status: ExecutionState;
  canonical_status?: CanonicalExecutionState;
  verification_state: ExecutionState;
  business_object_type?: string;
  business_object_id?: string;
  provider_reference?: string;
  receipt_id?: string;
  approval_state?: string;
  failure_code?: string;
  retryable?: boolean;
  next_action?: string;
  idempotency_key: string;
  execution_source: string;
  ok: boolean;
  result?: TResult;
  receipt?: ActionReceipt | null;
  error?: NormalizedExecutionError;
};

export function domainResultFromGateway<TResult>(params: {
  executionSource: string;
  gateway: {
    ok: boolean;
    actionId: string;
    auditLogId: string | null;
    idempotencyKey: string;
    status?: string;
    result?: TResult;
    receipt?: ActionReceipt | null;
    error?: { code: string; message: string; retryable?: boolean; remediation?: string; details?: unknown };
  };
  businessObject?: { type?: string; id?: string };
  approvalState?: string;
}): DomainExecutionResult<TResult> {
  const receiptStatus =
    params.gateway.receipt?.status ||
    params.gateway.status ||
    (params.gateway.ok ? 'completed' : 'failed');
  const status = normalizeExecutionState(receiptStatus);
  const canonical_status = normalizeCanonicalExecutionState(receiptStatus);
  return {
    execution_id: params.gateway.actionId,
    status,
    canonical_status,
    verification_state: status,
    // ActionReceipt allows null; DomainExecutionResult uses optional string only.
    business_object_type:
      (params.businessObject?.type ?? params.gateway.receipt?.entity_type) ?? undefined,
    business_object_id:
      (params.businessObject?.id ?? params.gateway.receipt?.entity_id) ?? undefined,
    provider_reference: params.gateway.receipt?.provider_reference ?? undefined,
    receipt_id: params.gateway.auditLogId || undefined,
    approval_state: params.approvalState,
    failure_code: params.gateway.error?.code,
    retryable: params.gateway.error?.retryable,
    next_action: params.gateway.ok
      ? undefined
      : status === 'UNKNOWN_EXECUTION_STATE'
        ? 'reconcile_before_retry'
        : params.gateway.error?.retryable
          ? 'retry_with_same_idempotency_key'
          : undefined,
    idempotency_key: params.gateway.idempotencyKey,
    execution_source: params.executionSource,
    ok: params.gateway.ok,
    result: params.gateway.result,
    receipt: params.gateway.receipt,
    error: params.gateway.error
      ? {
          code: params.gateway.error.code as NormalizedExecutionError['code'],
          message: params.gateway.error.message,
          retryable: params.gateway.error.retryable,
          remediation: params.gateway.error.remediation,
          details: params.gateway.error.details,
        }
      : undefined,
  };
}
