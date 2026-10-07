const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'api_key',
  'apikey',
  'secret',
  'body_html',
  'body_text',
  'body',
  'email_body',
  'oauth',
  'client_secret',
  'content_base64',
  'file_base64',
  'image_base64',
  'media_base64',
  'base64',
  'data_url',
  'file_content',
  'binary',
]);

export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.startsWith('data:') && value.includes('base64,')) {
      return `[data-url ~${Math.round((value.length * 3) / 4)} bytes]`;
    }
    if (value.length > 500) return `[redacted ${value.length} chars]`;
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeForAudit(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase()) || /token|secret|password|authorization/i.test(k)) {
        out[k] = '[redacted]';
      } else {
        out[k] = sanitizeForAudit(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}
