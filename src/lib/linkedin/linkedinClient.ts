export class LinkedInApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
    public readonly code?: 'TOKEN_EXPIRED' | 'RATE_LIMITED' | 'FORBIDDEN' | 'NOT_FOUND'
  ) {
    super(message);
    this.name = 'LinkedInApiError';
  }
}

type LinkedInFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  restli?: boolean;
  linkedInVersion?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyStatus(status: number, body: string): LinkedInApiError['code'] {
  if (status === 401) return 'TOKEN_EXPIRED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  return undefined;
}

export async function linkedInFetch(
  url: string,
  accessToken: string,
  init: RequestInit = {},
  options: LinkedInFetchOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 25000;
  const maxRetries = options.retries ?? 3;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (options.restli !== false) {
    headers.set('X-Restli-Protocol-Version', '2.0.0');
  }
  if (options.linkedInVersion) {
    headers.set('LinkedIn-Version', options.linkedInVersion);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let lastError: LinkedInApiError | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, headers, signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) return res;

      const body = await res.text().catch(() => '');
      const code = classifyStatus(res.status, body);

      if (res.status === 429 && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get('retry-after') || 0);
        const backoff = retryAfter > 0 ? retryAfter * 1000 : Math.min(8000, 500 * 2 ** attempt);
        await sleep(backoff);
        continue;
      }

      if (res.status >= 500 && attempt < maxRetries) {
        await sleep(400 * 2 ** attempt);
        continue;
      }

      lastError = new LinkedInApiError(
        body || `LinkedIn API error (${res.status})`,
        res.status,
        body,
        code
      );
      break;
    } catch (err) {
      clearTimeout(timer);
      if (attempt < maxRetries) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
      const message = err instanceof Error ? err.message : 'LinkedIn network error';
      throw new LinkedInApiError(message, 0);
    }
  }

  throw lastError ?? new LinkedInApiError('LinkedIn request failed', 0);
}

export async function linkedInJson<T = Record<string, unknown>>(
  url: string,
  accessToken: string,
  init?: RequestInit,
  options?: LinkedInFetchOptions
): Promise<T> {
  const res = await linkedInFetch(url, accessToken, init, options);
  return (await res.json().catch(() => ({}))) as T;
}
