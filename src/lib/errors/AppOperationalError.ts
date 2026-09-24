/**
 * AppOperationalError — shared error taxonomy for AlphaClone.
 *
 * All background jobs, email providers, OAuth flows, and AI integrations
 * should use this taxonomy to drive retry vs. abort decisions.
 *
 * RULES:
 *  - PERMANENT_* errors MUST NOT be retried. The cron / job must move on.
 *  - TRANSIENT_* and NETWORK_* errors MAY be retried with backoff.
 *  - RATE_LIMIT errors MUST be retried after an appropriate delay.
 *  - AUTHENTICATION_ERROR should retry once (token refresh), then abort.
 */

export type ErrorCategory =
  | 'PERMANENT_CONFIGURATION_ERROR' // Missing env var / unconfigured provider / missing sender email
  | 'PERMANENT_VALIDATION_ERROR'     // Bad data that cannot change between retries
  | 'AUTHENTICATION_ERROR'           // Bad API key / expired token
  | 'RATE_LIMIT'                     // Provider-side rate limit (retry after delay)
  | 'TRANSIENT_PROVIDER_ERROR'       // 5xx from provider — may succeed on retry
  | 'NETWORK_ERROR'                  // Connection timeout / DNS failure
  | 'INTERNAL_ERROR';                // Unexpected / unknown

export interface AppOperationalErrorOptions {
  code: string;
  category: ErrorCategory;
  retryable: boolean;
  provider?: string;
  tenantId?: string;
  operationId?: string;
  correlationId?: string;
  cause?: unknown;
}

export class AppOperationalError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly provider: string | undefined;
  readonly tenantId: string | undefined;
  readonly operationId: string | undefined;
  readonly correlationId: string | undefined;
  readonly cause: unknown;

  constructor(message: string, options: AppOperationalErrorOptions) {
    super(message);
    this.name = 'AppOperationalError';
    this.code = options.code;
    this.category = options.category;
    this.retryable = options.retryable;
    this.provider = options.provider;
    this.tenantId = options.tenantId;
    this.operationId = options.operationId;
    this.correlationId = options.correlationId;
    this.cause = options.cause;
  }
}

/**
 * Classify an error result from sendEmailServer into an ErrorCategory.
 * Permanent config errors (missing provider / sender email) are NOT retryable.
 */
export function classifyEmailError(code: string | undefined, error: string | undefined): {
  category: ErrorCategory;
  retryable: boolean;
} {
  if (!code && !error) return { category: 'INTERNAL_ERROR', retryable: false };

  switch (code) {
    case 'CONFIG_MISSING':
    case 'EMAIL_PROVIDER_UNAVAILABLE':
    case 'EMAIL_PROVIDER_ACCOUNT_TENANT_MISMATCH':
    case 'PROVIDER_CONFIG_INVALID':
      return { category: 'PERMANENT_CONFIGURATION_ERROR', retryable: false };

    case 'LOCAL_EMAIL_PERSISTENCE_FAILED':
      return { category: 'TRANSIENT_PROVIDER_ERROR', retryable: true };

    case 'ALL_PROVIDERS_FAILED': {
      // Distinguish: if all failures were config-related, treat as permanent.
      const msg = String(error || '').toLowerCase();
      const isConfigOnly =
        msg.includes('sender email is missing') ||
        msg.includes('sender identity is missing') ||
        msg.includes('no connected email provider');
      return isConfigOnly
        ? { category: 'PERMANENT_CONFIGURATION_ERROR', retryable: false }
        : { category: 'TRANSIENT_PROVIDER_ERROR', retryable: true };
    }

    case 'INTERNAL_ERROR':
      return { category: 'INTERNAL_ERROR', retryable: false };

    default:
      // Unknown codes: treat as transient to avoid silent data loss
      return { category: 'TRANSIENT_PROVIDER_ERROR', retryable: true };
  }
}

/**
 * Returns true when a task/lead reminder failure is a permanent configuration
 * problem that should suppress re-queuing (stamp reminder_at) but not alarm.
 */
export function isPermanentEmailConfigError(code: string | undefined, error: string | undefined): boolean {
  const { category } = classifyEmailError(code, error);
  return category === 'PERMANENT_CONFIGURATION_ERROR';
}
