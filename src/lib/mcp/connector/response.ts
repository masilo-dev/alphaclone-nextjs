import type {
  ConnectorErrorBody,
  ConnectorResult,
  ConnectorSuccess,
  PaginationMeta,
} from './types';

export function okResult<T>(
  tool: string,
  data: T,
  options?: { pagination?: PaginationMeta; meta?: Record<string, unknown> }
): ConnectorSuccess<T> {
  return {
    ok: true,
    tool,
    data,
    ...(options?.pagination ? { pagination: options.pagination } : {}),
    ...(options?.meta ? { meta: options.meta } : {}),
  };
}

export function errorResult(
  tool: string,
  code: string,
  message: string,
  details?: unknown
): ConnectorErrorBody {
  return {
    ok: false,
    tool,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
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
