import type {
  ActionReceipt,
  ConnectorErrorBody,
  ConnectorResult,
  ConnectorSuccess,
  PaginationMeta,
} from './types';
import { sanitizeUserFacingError } from '@/lib/copy/businessFriendlyErrors';

export function okResult<T>(
  tool: string,
  data: T,
  options?: {
    pagination?: PaginationMeta;
    meta?: Record<string, unknown>;
    receipt?: Partial<ActionReceipt> | null;
  }
): ConnectorSuccess<T> {
  const receipt: ActionReceipt | null | undefined =
    options?.receipt === null
      ? null
      : options?.receipt
        ? {
            action_id: options.receipt.action_id || crypto.randomUUID(),
            status: options.receipt.status || 'completed',
            provider: options.receipt.provider ?? null,
            provider_reference: options.receipt.provider_reference ?? null,
            timestamp: options.receipt.timestamp || new Date().toISOString(),
            entity_id: options.receipt.entity_id ?? null,
            entity_type: options.receipt.entity_type ?? null,
            live_url: options.receipt.live_url ?? null,
            verification: options.receipt.verification || {},
            rollback_available: options.receipt.rollback_available ?? false,
            retry_available: options.receipt.retry_available ?? false,
          }
        : undefined;

  return {
    ok: true,
    tool,
    data,
    error: null,
    ...(receipt !== undefined ? { receipt } : {}),
    ...(options?.pagination ? { pagination: options.pagination } : {}),
    ...(options?.meta ? { meta: options.meta } : {}),
  };
}

export function errorResult(
  tool: string,
  code: string,
  message: string,
  details?: unknown,
  options?: { retryable?: boolean; approval_id?: string; meta?: Record<string, unknown> }
): ConnectorErrorBody {
  const safeMessage = sanitizeUserFacingError(message, { tool });
  return {
    ok: false,
    tool,
    data: null,
    receipt: null,
    error: {
      code,
      message: safeMessage,
      retryable: options?.retryable ?? false,
      ...(options?.approval_id ? { approval_id: options.approval_id } : {}),
    },
    ...(options?.meta ? { meta: options.meta } : {}),
  };
}

export function toMcpContent<T>(result: ConnectorResult<T>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    isError: result.ok === false,
  };
}

export function throwConnectorError(code: string, message: string, details?: unknown): never {
  const err = new Error(message) as Error & { code?: string; details?: unknown };
  err.code = code;
  err.details = details;
  throw err;
}
