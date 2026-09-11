/**
 * Normalize AI image provider failures (OpenAI, xAI/Grok) into actionable codes.
 * Used by /api/ai/image, MCP social tools, and publish fallbacks.
 */

export type ImageProviderErrorCode =
  | 'IMAGE_PROVIDER_BILLING_INACTIVE'
  | 'IMAGE_PROVIDER_RATE_LIMIT'
  | 'IMAGE_PROVIDER_AUTH'
  | 'IMAGE_PROVIDER_UNAVAILABLE'
  | 'IMAGE_PROVIDER_ERROR';

export type ParsedImageProviderError = {
  code: ImageProviderErrorCode;
  message: string;
  provider?: string;
  httpStatus?: number;
  retryable: boolean;
  /** When true, social publish flows should continue caption-only. */
  fallbackToTextOnly: boolean;
  details?: unknown;
};

function extractProviderMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const obj = payload as Record<string, unknown>;
  const nested =
    obj.error && typeof obj.error === 'object'
      ? (obj.error as Record<string, unknown>)
      : null;
  const candidates = [
    nested?.message,
    obj.message,
    nested?.code,
    obj.code,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function isBillingOrQuotaMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('billing') ||
    lower.includes('inactive') ||
    lower.includes('payment') ||
    lower.includes('credit') ||
    lower.includes('quota') ||
    lower.includes('exceeded your current') ||
    lower.includes('insufficient') ||
    lower.includes('hard limit') ||
    lower.includes('account is not active') ||
    lower.includes('must be activated')
  );
}

export function parseImageProviderError(params: {
  payload?: unknown;
  httpStatus?: number;
  provider?: string;
  fallbackMessage?: string;
}): ParsedImageProviderError {
  const { payload, httpStatus, provider, fallbackMessage } = params;
  const message =
    extractProviderMessage(payload) ||
    fallbackMessage ||
    'Image generation failed';

  const nested =
    payload && typeof payload === 'object' && (payload as Record<string, unknown>).error
      ? ((payload as Record<string, unknown>).error as Record<string, unknown>)
      : null;
  const nestedCode =
    typeof nested?.code === 'string' ? nested.code.toLowerCase() : '';

  if (
    httpStatus === 402 ||
    nestedCode === 'billing_hard_limit_reached' ||
    nestedCode === 'billing_not_active' ||
    nestedCode === 'account_deactivated' ||
    isBillingOrQuotaMessage(message)
  ) {
    return {
      code: 'IMAGE_PROVIDER_BILLING_INACTIVE',
      message: `AI image provider billing is inactive or exhausted: ${message}`,
      provider,
      httpStatus,
      retryable: false,
      fallbackToTextOnly: true,
      details: payload,
    };
  }

  if (httpStatus === 429 || nestedCode === 'rate_limit_exceeded') {
    return {
      code: 'IMAGE_PROVIDER_RATE_LIMIT',
      message: `AI image provider rate limit: ${message}`,
      provider,
      httpStatus,
      retryable: true,
      fallbackToTextOnly: true,
      details: payload,
    };
  }

  if (httpStatus === 401 || httpStatus === 403 || nestedCode === 'invalid_api_key') {
    return {
      code: 'IMAGE_PROVIDER_AUTH',
      message: `AI image provider authentication failed: ${message}`,
      provider,
      httpStatus,
      retryable: false,
      fallbackToTextOnly: true,
      details: payload,
    };
  }

  if (httpStatus != null && httpStatus >= 500) {
    return {
      code: 'IMAGE_PROVIDER_UNAVAILABLE',
      message: `AI image provider unavailable: ${message}`,
      provider,
      httpStatus,
      retryable: true,
      fallbackToTextOnly: true,
      details: payload,
    };
  }

  return {
    code: 'IMAGE_PROVIDER_ERROR',
    message,
    provider,
    httpStatus,
    retryable: false,
    fallbackToTextOnly: true,
    details: payload,
  };
}

export function formatImageProviderErrorForUser(error: ParsedImageProviderError): string {
  return error.message;
}
