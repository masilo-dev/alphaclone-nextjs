/**
 * Retry helper with exponential backoff, jitter, and finite attempts.
 */

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Return false to stop retrying immediately. */
  isRetryable?: (err: unknown, attempt: number) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
};

const DEFAULT_NON_RETRYABLE =
  /invalid_grant|client_id mismatch|unauthorized|forbidden|401|403|validation|invalid_request|not found|404|422/i;

export function isTransientError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  if (DEFAULT_NON_RETRYABLE.test(message)) return false;
  return /timeout|503|502|504|429|econnreset|enotfound|network|unavailable|rate.?limit/i.test(
    message
  );
}

export function computeBackoffDelay(
  attempt: number,
  baseDelayMs = 1_000,
  maxDelayMs = 30_000
): number {
  const exp = Math.min(baseDelayMs * 2 ** Math.max(attempt - 1, 0), maxDelayMs);
  const jitter = Math.floor(Math.random() * Math.min(1_000, exp * 0.15));
  return exp + jitter;
}

export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 1_000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const isRetryable = options.isRetryable ?? isTransientError;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !isRetryable(err, attempt)) {
        throw err;
      }
      const delayMs = computeBackoffDelay(attempt, baseDelayMs, maxDelayMs);
      options.onRetry?.(err, attempt, delayMs);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}
