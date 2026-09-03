/**
 * HTTP fetch with finite timeout via AbortController.
 */

export type FetchWithTimeoutOptions = RequestInit & {
  timeoutMs?: number;
  label?: string;
};

export class FetchTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchTimeoutError';
  }
}

export async function fetchWithTimeout(
  url: string | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = 30_000, label, signal: externalSignal, ...init } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new FetchTimeoutError(
        `Request timed out after ${timeoutMs}ms${label ? `: ${label}` : ''}`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Default timeout presets for external integrations. */
export const HttpTimeouts = {
  normal: 15_000,
  ai: 90_000,
  browser: 120_000,
  database: 10_000,
  health: 2_500,
  webhook: 20_000,
} as const;
