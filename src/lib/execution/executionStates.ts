/**
 * Canonical execution + verification vocabulary for AlphaClone Systems.
 * Authoritative 6-state machine:
 * - queued: Request accepted but not started.
 * - executing: Execution actively running.
 * - pending_verification: Provider response or final outcome not yet confirmed.
 * - succeeded: Completion verified with authoritative evidence.
 * - failed: Definitive failure confirmed.
 * - cancelled: Execution explicitly cancelled.
 */

export const CANONICAL_EXECUTION_STATES = [
  'queued',
  'executing',
  'pending_verification',
  'succeeded',
  'failed',
  'cancelled',
] as const;

export type CanonicalExecutionState = (typeof CANONICAL_EXECUTION_STATES)[number];

export const VALID_EXECUTION_TRANSITIONS: Record<CanonicalExecutionState, ReadonlySet<CanonicalExecutionState>> = {
  queued: new Set(['executing', 'cancelled', 'failed']),
  executing: new Set(['pending_verification', 'succeeded', 'failed', 'cancelled']),
  pending_verification: new Set(['succeeded', 'failed', 'cancelled']),
  succeeded: new Set([]), // Terminal state: Never overwrite a verified success
  failed: new Set(['queued']), // Cannot transition out unless explicitly re-queued for retry
  cancelled: new Set([]), // Terminal state: Never transition out of explicit cancellation
};

/**
 * Normalizes any external or legacy status string to one of the canonical 6 states.
 * Unknown or ambiguous strings map to 'pending_verification' — never defaulting to 'failed'.
 */
export function normalizeCanonicalExecutionState(status: string | null | undefined): CanonicalExecutionState {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return 'queued';

  // Succeeded / Verified
  if (
    s === 'succeeded' ||
    s === 'verified' ||
    s === 'completed' ||
    s === 'published' ||
    s === 'sent' ||
    s === 'delivered'
  ) {
    return 'succeeded';
  }

  // Executing / In-flight
  if (s === 'executing' || s === 'running' || s === 'processing') {
    return 'executing';
  }

  // Pending verification / Ambiguous transport
  if (
    s === 'pending_verification' ||
    s === 'verification_pending' ||
    s === 'provider_accepted' ||
    s === 'provider_processing' ||
    s === 'publishing' ||
    s === 'outcome_unknown' ||
    s === 'unknown_execution_state' ||
    s === 'unknown'
  ) {
    return 'pending_verification';
  }

  // Failed
  if (s === 'failed' || s === 'failure' || s === 'verification_failed') {
    return 'failed';
  }

  // Cancelled
  if (s === 'cancelled' || s === 'canceled') {
    return 'cancelled';
  }

  // Queued / Pending start
  if (
    s === 'queued' ||
    s === 'pending' ||
    s === 'scheduled' ||
    s === 'awaiting_approval' ||
    s === 'requested' ||
    s === 'draft'
  ) {
    return 'queued';
  }

  // Safe fallback for unclassified strings: pending_verification, NEVER failed
  return 'pending_verification';
}

/**
 * Validates whether a state transition from `current` to `next` is allowed.
 */
export function isValidExecutionTransition(
  current: string | null | undefined,
  next: string | null | undefined
): boolean {
  const fromState = normalizeCanonicalExecutionState(current);
  const toState = normalizeCanonicalExecutionState(next);

  // Re-affirming the same state is idempotent
  if (fromState === toState) return true;

  const allowed = VALID_EXECUTION_TRANSITIONS[fromState];
  return allowed ? allowed.has(toState) : false;
}

/**
 * Checks if a state is terminal. Terminal states cannot be changed by ordinary runtime updates.
 */
export function isTerminalExecutionState(state: string | null | undefined): boolean {
  const canonical = normalizeCanonicalExecutionState(state);
  return canonical === 'succeeded' || canonical === 'cancelled';
}

/**
 * Helper to determine whether an error or timeout should yield 'pending_verification'
 * rather than a definitive 'failed'.
 */
export function isAmbiguousTransportError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : typeof error === 'object' && error && 'message' in error
      ? String((error as { message: unknown }).message)
      : '';
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code: unknown }).code).toUpperCase()
      : '';

  return (
    code === 'PROVIDER_TIMEOUT' ||
    code === 'OUTCOME_UNKNOWN' ||
    code === 'UNKNOWN_EXECUTION_STATE' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'EHOSTUNREACH' ||
    /timeout|network|econn|socket|gateway|abort|timed out/i.test(message)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Compatibility Layer
// ─────────────────────────────────────────────────────────────────────────────

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

/** Maps legacy receipt / external_actions status strings to legacy uppercase execution state. */
export function normalizeExecutionState(status: string | null | undefined): ExecutionState {
  const s = String(status || '').toLowerCase();
  if (!s) return 'REQUESTED';
  if (s === 'verified' || s === 'completed' || s === 'published' || s === 'sent' || s === 'succeeded') return 'VERIFIED';
  if (s === 'outcome_unknown' || s === 'unknown_execution_state' || s === 'unknown' || s === 'pending_verification') {
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

