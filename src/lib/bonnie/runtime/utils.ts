/**
 * Feature flag and thin helpers for durable runtime.
 */

export { isDurableRuntimeEnabled } from './types';

export function buildIdempotencyKey(parts: {
  tenantId: string;
  taskId: string;
  actionType: string;
  targetRecordId?: string | null;
  actionVersion?: string | number;
}): string {
  return [
    parts.tenantId,
    parts.taskId,
    parts.actionType,
    parts.targetRecordId || '_',
    String(parts.actionVersion ?? '1'),
  ].join(':');
}

export function classifyError(err: unknown): {
  category: string;
  retryable: boolean;
  code: string;
  message: string;
} {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    /permission|forbidden|unauthorized|denied|policy|validation|invalid recipient|not found|deleted|unsupported|rejected/.test(
      lower
    )
  ) {
    return {
      category: 'non_retryable',
      retryable: false,
      code: 'NON_RETRYABLE',
      message,
    };
  }

  if (/timeout|rate limit|network|unavailable|deadlock|econnreset|503|429|provider/.test(lower)) {
    return {
      category: 'retryable',
      retryable: true,
      code: 'TRANSIENT',
      message,
    };
  }

  if (/uncertain|ambiguous|no response/.test(lower)) {
    return {
      category: 'uncertain',
      retryable: false,
      code: 'UNCERTAIN',
      message,
    };
  }

  return {
    category: 'unknown',
    retryable: true,
    code: 'UNKNOWN',
    message,
  };
}

export function backoffWithJitter(attempt: number, baseMs = 60_000, maxMs = 3_600_000): number {
  const exp = Math.min(baseMs * 2 ** Math.max(attempt - 1, 0), maxMs);
  const jitter = Math.floor(Math.random() * Math.min(5_000, exp * 0.1));
  return exp + jitter;
}
