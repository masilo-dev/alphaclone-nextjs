/**
 * Normalized email error codes for UI, Bonnie, and MCP clients.
 * Map provider/raw failures into stable, actionable categories.
 */

export type EmailErrorCode =
  | 'AUTH_REQUIRED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REVOKED'
  | 'MAILBOX_DISCONNECTED'
  | 'PROVIDER_RATE_LIMIT'
  | 'ALPHACLONE_QUOTA_EXCEEDED'
  | 'INVALID_RECIPIENT'
  | 'MESSAGE_REJECTED'
  | 'DOMAIN_NOT_VERIFIED'
  | 'SENDER_NOT_VERIFIED'
  | 'DAILY_SEND_LIMIT'
  | 'ATTACHMENT_TOO_LARGE'
  | 'NETWORK_FAILURE'
  | 'PROVIDER_FAILURE'
  | 'SYNC_FAILURE'
  | 'TIMEOUT'
  | 'BLOCKED_RECIPIENT'
  | 'RECIPIENT_SUPPRESSED'
  | 'CIRCUIT_OPEN'
  | 'LOCAL_EMAIL_PERSISTENCE_FAILED'
  | 'MISSING_FIELDS'
  | 'MISSING_CONTENT'
  | 'UNKNOWN';

export type EmailErrorEnvelope = {
  code: EmailErrorCode;
  message: string;
  retryable: boolean;
  provider?: string;
  subsystem?: 'alphaclone' | 'provider' | 'quota' | 'validation';
  suggestedAction?: string;
};

const RETRYABLE = new Set<EmailErrorCode>([
  'PROVIDER_RATE_LIMIT',
  'NETWORK_FAILURE',
  'PROVIDER_FAILURE',
  'SYNC_FAILURE',
  'TIMEOUT',
]);

export function classifyEmailError(input: {
  rawMessage?: string;
  code?: string;
  provider?: string;
}): EmailErrorEnvelope {
  const raw = `${input.code || ''} ${input.rawMessage || ''}`.toLowerCase();

  if (/quota|daily limit|limit reached/.test(raw)) {
    return {
      code: 'ALPHACLONE_QUOTA_EXCEEDED',
      message: 'Daily email allowance reached for your plan.',
      retryable: false,
      subsystem: 'quota',
      suggestedAction: 'Upgrade your plan or wait until tomorrow UTC.',
    };
  }
  if (/circuit_open|circuit open/.test(raw)) {
    return {
      code: 'CIRCUIT_OPEN',
      message: 'Mailbox reads are paused after repeated provider failures.',
      retryable: false,
      provider: input.provider,
      subsystem: 'alphaclone',
      suggestedAction: 'Reconnect the provider in Settings, then retry.',
    };
  }
  if (/token expired|expired token|401|unauthorized/.test(raw)) {
    return {
      code: 'TOKEN_EXPIRED',
      message: 'Email provider authorization expired.',
      retryable: false,
      provider: input.provider,
      subsystem: 'provider',
      suggestedAction: 'Reconnect your mailbox in Integrations.',
    };
  }
  if (/revoked|invalid oauth|invalid_grant/.test(raw)) {
    return {
      code: 'TOKEN_REVOKED',
      message: 'Email provider access was revoked.',
      retryable: false,
      provider: input.provider,
      subsystem: 'provider',
      suggestedAction: 'Reconnect your mailbox in Integrations.',
    };
  }
  if (/429|rate limit|too many/.test(raw)) {
    return {
      code: 'PROVIDER_RATE_LIMIT',
      message: 'The email provider is rate-limiting requests.',
      retryable: true,
      provider: input.provider,
      subsystem: 'provider',
      suggestedAction: 'Wait a few minutes and retry.',
    };
  }
  if (/timeout|timed out|econnreset|network/.test(raw)) {
    return {
      code: 'NETWORK_FAILURE',
      message: 'Network error while contacting the email provider.',
      retryable: true,
      provider: input.provider,
      subsystem: 'provider',
      suggestedAction: 'Retry shortly.',
    };
  }
  if (/suppressed|unsubscribe|blocked_recipient|blocked recipient/.test(raw)) {
    return {
      code: 'RECIPIENT_SUPPRESSED',
      message: 'This recipient is suppressed or blocked.',
      retryable: false,
      subsystem: 'validation',
      suggestedAction: 'Remove the recipient from suppression or use a different address.',
    };
  }
  if (/invalid recipient|malformed|550|553/.test(raw)) {
    return {
      code: 'INVALID_RECIPIENT',
      message: 'The recipient address was rejected.',
      retryable: false,
      subsystem: 'validation',
    };
  }
  if (/domain not verified|spf|dkim|sender not verified/.test(raw)) {
    return {
      code: 'SENDER_NOT_VERIFIED',
      message: 'The sender domain or address is not verified.',
      retryable: false,
      provider: input.provider,
      subsystem: 'provider',
      suggestedAction: 'Verify your sending domain in the provider dashboard.',
    };
  }
  if (/attachment|too large|size limit/.test(raw)) {
    return {
      code: 'ATTACHMENT_TOO_LARGE',
      message: 'An attachment exceeds the provider size limit.',
      retryable: false,
      subsystem: 'validation',
    };
  }
  if (/local_email_persistence|canonical email/.test(raw)) {
    return {
      code: 'LOCAL_EMAIL_PERSISTENCE_FAILED',
      message: 'The provider accepted the message but AlphaClone could not save it to your timeline.',
      retryable: true,
      subsystem: 'alphaclone',
      suggestedAction: 'Retry; if it persists, contact support with the operation ID.',
    };
  }

  const normalizedCode = String(input.code || '').toUpperCase() as EmailErrorCode;
  if (normalizedCode && normalizedCode !== 'UNKNOWN' && Object.prototype.hasOwnProperty.call(RETRYABLE, normalizedCode) === false) {
    return {
      code: normalizedCode,
      message: input.rawMessage || 'Email operation failed.',
      retryable: RETRYABLE.has(normalizedCode),
      provider: input.provider,
      subsystem: 'provider',
    };
  }

  return {
    code: 'UNKNOWN',
    message: input.rawMessage || 'Email operation failed.',
    retryable: false,
    provider: input.provider,
    subsystem: 'provider',
  };
}

export function emailErrorToMcpPayload(envelope: EmailErrorEnvelope, extras?: Record<string, unknown>) {
  return {
    success: false,
    ok: false,
    error: {
      code: envelope.code,
      message: envelope.message,
      retryable: envelope.retryable,
      provider: envelope.provider,
      subsystem: envelope.subsystem,
      suggested_action: envelope.suggestedAction,
    },
    ...extras,
  };
}
