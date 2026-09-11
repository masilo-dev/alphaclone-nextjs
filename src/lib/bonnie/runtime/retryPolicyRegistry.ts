/**
 * Shared retry classification for Bonnie durable runtime and legacy queues.
 */

import { classifyError } from './utils';

export type RetryClassification = {
  code: string;
  message: string;
  retryable: boolean;
  category: string;
  backoffMs?: number;
};

export function classifyRetryableExecutionError(error: unknown): RetryClassification {
  const classified = classifyError(error);
  return {
    code: classified.code,
    message: classified.message,
    retryable: classified.retryable,
    category: classified.category,
    backoffMs: classified.retryable ? 60_000 : undefined,
  };
}

export function shouldRetryAttempt(params: {
  attemptNumber: number;
  maxAttempts: number;
  error: unknown;
}): boolean {
  const classified = classifyRetryableExecutionError(params.error);
  return classified.retryable && params.attemptNumber < params.maxAttempts;
}

export function humanReadableFailure(error: unknown, nextRetryAt?: string | null): string {
  const classified = classifyRetryableExecutionError(error);
  if (nextRetryAt && classified.retryable) {
    return `${classified.message} — next retry scheduled at ${nextRetryAt}`;
  }
  return classified.message;
}
