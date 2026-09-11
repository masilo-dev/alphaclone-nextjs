export class MetaGraphApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
    public readonly code?: 'TOKEN_EXPIRED' | 'RATE_LIMITED' | 'FORBIDDEN' | 'NOT_FOUND'
  ) {
    super(message);
    this.name = 'MetaGraphApiError';
  }
}

type MetaGraphFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  graphVersion?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyStatus(status: number): MetaGraphApiError['code'] {
  if (status === 401) return 'TOKEN_EXPIRED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  return undefined;
}

export async function metaGraphFetch(
  pathOrUrl: string,
  accessToken: string,
  init: RequestInit = {},
  options: MetaGraphFetchOptions = {}
): Promise<Response> {
  const version = options.graphVersion ?? 'v19.0';
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `https://graph.facebook.com/${version}/${pathOrUrl.replace(/^\//, '')}`;
  const timeoutMs = options.timeoutMs ?? 25000;
  const maxRetries = options.retries ?? 3;
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const separator = url.includes('?') ? '&' : '?';
  const authedUrl = url.includes('access_token=')
    ? url
    : `${url}${separator}access_token=${encodeURIComponent(accessToken)}`;

  let lastError: MetaGraphApiError | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(authedUrl, { ...init, headers, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;

      const body = await res.text().catch(() => '');
      const code = classifyStatus(res.status);
      if (res.status === 429 && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get('retry-after') || 0);
        await sleep(retryAfter > 0 ? retryAfter * 1000 : Math.min(8000, 500 * 2 ** attempt));
        continue;
      }
      if (res.status >= 500 && attempt < maxRetries) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
      lastError = new MetaGraphApiError(body || `Meta Graph API error (${res.status})`, res.status, body, code);
      break;
    } catch (err) {
      clearTimeout(timer);
      if (attempt < maxRetries) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
      throw new MetaGraphApiError(err instanceof Error ? err.message : 'Meta Graph network error', 0);
    }
  }
  throw lastError ?? new MetaGraphApiError('Meta Graph request failed', 0);
}

export async function metaGraphJson<T = Record<string, unknown>>(
  pathOrUrl: string,
  accessToken: string,
  init?: RequestInit,
  options?: MetaGraphFetchOptions
): Promise<T> {
  const res = await metaGraphFetch(pathOrUrl, accessToken, init, options);
  return (await res.json().catch(() => ({}))) as T;
}
