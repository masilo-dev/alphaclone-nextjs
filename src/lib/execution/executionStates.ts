/**
 * Canonical execution + verification vocabulary for external writes.
 * LLM-facing responses must use these states — never imply completion without VERIFIED.
 */

export const EXECUTION_STATES = [
  'REQUESTED',
  'QUEUED',
  'EXECUTING',
  'PROVIDER_PROCESSING',
  'VERIFIED',
  'FAILED',
  'UNKNOWN_EXECUTION_STATE',
] as const;

export type ExecutionState = (typeof EXECUTION_STATES)[number];

export const APPROVAL_STATES = ['none', 'required', 'queued', 'approved', 'mcp_auto_allowed'] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

/** Maps legacy receipt / external_actions status strings to canonical execution state. */
export function normalizeExecutionState(status: string | null | undefined): ExecutionState {
  const s = String(status || '').toLowerCase();
  if (!s) return 'REQUESTED';
  if (s === 'verified' || s === 'completed' || s === 'published' || s === 'sent') return 'VERIFIED';
  if (s === 'outcome_unknown' || s === 'unknown_execution_state' || s === 'unknown') {
    return 'UNKNOWN_EXECUTION_STATE';
  }
  if (s === 'failed' || s === 'failure' || s === 'verification_failed') return 'FAILED';
  if (s === 'queued' || s === 'scheduled' || s === 'awaiting_approval') return 'QUEUED';
  if (s === 'running' || s === 'executing' || s === 'processing') return 'EXECUTING';
  if (s === 'provider_accepted' || s === 'provider_processing' || s === 'publishing') return 'PROVIDER_PROCESSING';
  if (s === 'requested' || s === 'draft') return 'REQUESTED';
  return 'EXECUTING';
}

export function llmSafeCompletionClaim(state: ExecutionState): boolean {
  return state === 'VERIFIED';
}

export function llmStatusPhrase(state: ExecutionState): string {
  switch (state) {
    case 'VERIFIED':
      return 'Verified — AlphaClone has evidence the action completed.';
    case 'PROVIDER_PROCESSING':
      return 'Provider is still processing — not verified yet.';
    case 'QUEUED':
      return 'Queued — execution has not finished.';
    case 'EXECUTING':
      return 'Executing — wait for receipt before claiming completion.';
    case 'REQUESTED':
      return 'Requested — not yet executed.';
    case 'UNKNOWN_EXECUTION_STATE':
      return 'Execution outcome unknown — reconcile before retrying or claiming success.';
    case 'FAILED':
      return 'Failed — do not claim success.';
    default: {
      const _exhaustive: never = state;
      return String(_exhaustive);
    }
  }
}
