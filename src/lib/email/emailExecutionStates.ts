/**
 * Canonical 8-State Email Execution Lifecycle
 *
 * Guaranteed States:
 * 1. REQUESTED - Intent recorded, preflights passed.
 * 2. QUEUED - Claimed and placed in outbound execution queue.
 * 3. PROVIDER_ACCEPTED - Provider (SendGrid, Resend, Brevo, Zoho) acknowledged receipt with message ID.
 * 4. SENT_FOLDER_CONFIRMED - Verified presence in provider sent logs / outbox.
 * 5. DELIVERED - Receiving server confirmed final delivery (webhook/event receipt).
 * 6. BOUNCED - Hard or soft bounce reported by destination MX.
 * 7. FAILED - Dropped or rejected prior to or during provider transmission.
 * 8. UNKNOWN_PENDING_VERIFICATION - Ambiguous state (e.g., timeout before provider ACK) awaiting reconciliation.
 */

export type EmailExecutionState =
  | 'REQUESTED'
  | 'QUEUED'
  | 'PROVIDER_ACCEPTED'
  | 'SENT_FOLDER_CONFIRMED'
  | 'DELIVERED'
  | 'BOUNCED'
  | 'FAILED'
  | 'UNKNOWN_PENDING_VERIFICATION';

export const ALL_EMAIL_EXECUTION_STATES: readonly EmailExecutionState[] = [
  'REQUESTED',
  'QUEUED',
  'PROVIDER_ACCEPTED',
  'SENT_FOLDER_CONFIRMED',
  'DELIVERED',
  'BOUNCED',
  'FAILED',
  'UNKNOWN_PENDING_VERIFICATION',
] as const;

export const VALID_EMAIL_TRANSITIONS: Record<EmailExecutionState, readonly EmailExecutionState[]> = {
  REQUESTED: ['QUEUED', 'PROVIDER_ACCEPTED', 'SENT_FOLDER_CONFIRMED', 'FAILED', 'UNKNOWN_PENDING_VERIFICATION'],
  QUEUED: ['PROVIDER_ACCEPTED', 'SENT_FOLDER_CONFIRMED', 'FAILED', 'UNKNOWN_PENDING_VERIFICATION'],
  PROVIDER_ACCEPTED: ['SENT_FOLDER_CONFIRMED', 'DELIVERED', 'BOUNCED', 'FAILED', 'UNKNOWN_PENDING_VERIFICATION'],
  SENT_FOLDER_CONFIRMED: ['DELIVERED', 'BOUNCED', 'FAILED', 'UNKNOWN_PENDING_VERIFICATION'],
  DELIVERED: [], // Terminal success
  BOUNCED: [], // Terminal delivery failure
  FAILED: ['QUEUED'], // Terminal unless explicitly retried
  UNKNOWN_PENDING_VERIFICATION: ['PROVIDER_ACCEPTED', 'SENT_FOLDER_CONFIRMED', 'DELIVERED', 'BOUNCED', 'FAILED'],
};

/**
 * Validate whether a transition between execution states is legal.
 */
export function isValidEmailStateTransition(
  from: EmailExecutionState,
  to: EmailExecutionState
): boolean {
  if (from === to) return true;
  const allowed = VALID_EMAIL_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

/**
 * Normalize arbitrary legacy/provider status strings into one of the 8 canonical states.
 */
export function normalizeEmailExecutionState(value: unknown): EmailExecutionState {
  if (!value) return 'UNKNOWN_PENDING_VERIFICATION';
  const raw = String(value).trim().toUpperCase();

  switch (raw) {
    case 'REQUESTED':
      return 'REQUESTED';
    case 'QUEUED':
    case 'PENDING':
    case 'SENDING':
      return 'QUEUED';
    case 'PROVIDER_ACCEPTED':
    case 'ACCEPTED':
    case 'SENT': // Legacy sent is provider acceptance
      return 'PROVIDER_ACCEPTED';
    case 'SENT_FOLDER_CONFIRMED':
    case 'CONFIRMED':
      return 'SENT_FOLDER_CONFIRMED';
    case 'DELIVERED':
    case 'OPENED':
    case 'CLICKED':
      return 'DELIVERED';
    case 'BOUNCED':
    case 'BOUNCE':
    case 'DROPPED':
    case 'SPAM':
      return 'BOUNCED';
    case 'FAILED':
    case 'REJECTED':
    case 'ERROR':
      return 'FAILED';
    case 'UNKNOWN_PENDING_VERIFICATION':
    case 'DEFERRED':
    case 'UNKNOWN':
      return 'UNKNOWN_PENDING_VERIFICATION';
    default:
      return 'UNKNOWN_PENDING_VERIFICATION';
  }
}

export function isTerminalEmailState(state: EmailExecutionState): boolean {
  return state === 'DELIVERED' || state === 'BOUNCED' || state === 'FAILED';
}

export function isSuccessfulEmailState(state: EmailExecutionState): boolean {
  return (
    state === 'DELIVERED' ||
    state === 'SENT_FOLDER_CONFIRMED' ||
    state === 'PROVIDER_ACCEPTED'
  );
}
