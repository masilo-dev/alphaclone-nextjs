import type { PolicyDecision } from '@/lib/ai/ToolPolicyGate';
import {
  llmSafeCompletionClaim,
  llmStatusPhrase,
  normalizeExecutionState,
  type ExecutionState,
} from '@/lib/execution/executionStates';
import type { ActionReceipt } from '@/lib/mcp/standardResponse';

export type LlmExecutionTruth = {
  status: ExecutionState;
  verification_state: ExecutionState;
  approval_state: 'none' | 'required' | 'queued' | 'mcp_auto_allowed' | 'approved';
  may_claim_completed: boolean;
  user_message: string;
  receipt_id?: string | null;
  provider_reference?: string | null;
  business_object?: { type?: string; id?: string } | null;
  next_action?: string;
};

function extractReceiptFromPayload(payload: unknown): Partial<ActionReceipt> | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  if (obj.receipt && typeof obj.receipt === 'object') return obj.receipt as Partial<ActionReceipt>;
  if (obj.ok === true && obj.receipt) return obj.receipt as Partial<ActionReceipt>;
  return null;
}

export function buildLlmExecutionTruth(input: {
  toolName: string;
  policy?: PolicyDecision;
  parsedResult?: unknown;
  receipt?: Partial<ActionReceipt> | null;
}): LlmExecutionTruth {
  const receipt =
    input.receipt ||
    extractReceiptFromPayload(input.parsedResult) ||
    null;

  const rawStatus = receipt?.status || (input.parsedResult as any)?.status;
  const verificationState = normalizeExecutionState(rawStatus);

  let approval_state: LlmExecutionTruth['approval_state'] = 'none';
  if (input.policy?.approvalState) {
    approval_state = input.policy.approvalState;
  } else if (input.policy?.outcome === 'queue_approval') {
    approval_state = 'queued';
  } else if (input.policy?.sourcePolicy === 'mcp_connector_auto_allow') {
    approval_state = 'mcp_auto_allowed';
  }

  const may_claim = llmSafeCompletionClaim(verificationState);

  let user_message = llmStatusPhrase(verificationState);
  if (approval_state === 'queued') {
    user_message = 'Approval required before AlphaClone will execute this action.';
  } else if (approval_state === 'required') {
    user_message = 'Human approval is required.';
  } else if (!may_claim && verificationState !== 'FAILED') {
    user_message = `${user_message} Do not tell the user the action is finished.`;
  }

  return {
    status: verificationState,
    verification_state: verificationState,
    approval_state,
    may_claim_completed: may_claim,
    user_message,
    receipt_id: receipt?.action_id || null,
    provider_reference: receipt?.provider_reference || null,
    business_object:
      receipt?.entity_type || receipt?.entity_id
        ? { type: receipt.entity_type || undefined, id: receipt.entity_id || undefined }
        : null,
    next_action:
      verificationState === 'UNKNOWN_EXECUTION_STATE'
        ? 'Reconcile execution state with get_action_status or provider verification before retrying.'
        : approval_state === 'queued'
          ? 'Use approve_pending_action or the Approval Center.'
          : undefined,
  };
}

/** Attach execution_truth to connector-style JSON results for MCP clients. */
export function attachLlmExecutionTruth(
  parsed: Record<string, unknown>,
  truth: LlmExecutionTruth
): Record<string, unknown> {
  return {
    ...parsed,
    execution_truth: truth,
  };
}
