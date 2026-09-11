/**
 * Parse Facebook Graph API error payloads into actionable, token-safe diagnostics.
 */

export type FacebookGraphErrorDetails = {
  http_status: number;
  message: string;
  error_code: number | null;
  error_subcode: number | null;
  error_type: string | null;
  fbtrace_id: string | null;
  is_transient: boolean;
  user_title: string | null;
  user_message: string | null;
};

const SENSITIVE_KEYS = new Set([
  'access_token',
  'accessToken',
  'token',
  'page_access_token',
  'authorization',
]);

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key)) return '[REDACTED]';
  if (value && typeof value === 'object') return sanitizeFacebookPayload(value);
  return value;
}

/** Remove tokens from Graph API response bodies before logging or MCP output. */
export function sanitizeFacebookPayload(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeFacebookPayload(item));
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = redactValue(key, entry);
  }
  return out;
}

export function parseFacebookGraphError(
  httpStatus: number,
  body: unknown
): FacebookGraphErrorDetails {
  const payload =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const err =
    payload.error && typeof payload.error === 'object'
      ? (payload.error as Record<string, unknown>)
      : payload;

  const message =
    (typeof err.message === 'string' && err.message.trim()) ||
    (typeof payload.message === 'string' && payload.message.trim()) ||
    (httpStatus > 0 ? `Facebook Graph API error (HTTP ${httpStatus})` : 'Facebook Graph API error');

  const genericOnly = /^an unknown error has occurred\.?$/i.test(message);

  return {
    http_status: httpStatus,
    message: genericOnly
      ? 'Facebook returned a generic error — see error_code, error_subcode and fbtrace_id for support'
      : message,
    error_code: typeof err.code === 'number' ? err.code : null,
    error_subcode: typeof err.error_subcode === 'number' ? err.error_subcode : null,
    error_type: typeof err.type === 'string' ? err.type : null,
    fbtrace_id:
      typeof err.fbtrace_id === 'string'
        ? err.fbtrace_id
        : typeof payload.fbtrace_id === 'string'
          ? payload.fbtrace_id
          : null,
    is_transient: err.is_transient === true,
    user_title: typeof err.error_user_title === 'string' ? err.error_user_title : null,
    user_message: typeof err.error_user_msg === 'string' ? err.error_user_msg : null,
  };
}

export function formatFacebookGraphErrorMessage(details: FacebookGraphErrorDetails): string {
  const parts = [details.message];
  if (details.error_code != null) parts.push(`code=${details.error_code}`);
  if (details.error_subcode != null) parts.push(`subcode=${details.error_subcode}`);
  if (details.fbtrace_id) parts.push(`fbtrace_id=${details.fbtrace_id}`);
  if (details.user_message) parts.push(details.user_message);
  return parts.join(' | ');
}
