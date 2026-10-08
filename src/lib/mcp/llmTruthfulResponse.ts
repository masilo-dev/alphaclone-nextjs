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

  const result = input.parsedResult as any;
  const readCompleted = result != null && result?.ok !== false && result?.success !== false && /^(get|list|search|fetch|inspect)_/.test(input.toolName);
  const rawStatus = receipt?.status || (readCompleted ? undefined : result?.status);
  const mailboxPending = ['sync_all_inboxes','get_email_sync_status'].includes(input.toolName)
    && String(receipt?.status || result?.data?.status || result?.status).toLowerCase() === 'pending';
  const verificationState = result?.ok === false || result?.success === false ? 'FAILED'
    : mailboxPending ? 'REQUESTED'
    : readCompleted ? 'VERIFIED'
    : rawStatus ? normalizeExecutionState(rawStatus) : 'REQUESTED';

  let approval_state: LlmExecutionTruth['approval_state'] = 'none';
  if (input.policy?.approvalState) {
    approval_state = input.policy.approvalState;
  } else if (input.policy?.outcome === 'queue_approval') {
    approval_state = 'queued';
  } else if (input.policy?.sourcePolicy === 'mcp_connector_auto_allow') {
    approval_state = 'mcp_auto_allowed';
  }

  const may_claim = llmSafeCompletionClaim(verificationState);

  let user_message = mailboxPending ? 'Mailbox sync has unfinished batches. Resume sync_all_inboxes with the returned account_id and job_id; no background completion is promised.'
    : readCompleted ? 'Read completed. This confirms the lookup, not completion of any action described in the returned data.'
    : String(rawStatus).toLowerCase() === 'provider_accepted' ? 'Provider accepted the request. Final delivery has not been verified.'
    : llmStatusPhrase(verificationState);
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
      mailboxPending ? 'Resume sync_all_inboxes with account_id and job_id.'
        : verificationState === 'UNKNOWN_EXECUTION_STATE'
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
