export function retryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(0, delay) : null;
}

/** Per-browser read coalescing and origin cooldown. Mutations are never retried. */
export function createReadRequestClient(options: {
  fetch: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}) {
  const now = options.now || Date.now;
  const sleep = options.sleep || ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = options.random || Math.random;
  const pending = new Map<string, Promise<Response>>();
  const cooldown = new Map<string, { until: number; response: Response }>();
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const origin = new URL(url).origin;
    if (!['GET', 'HEAD'].includes(method) || url.includes('/auth/v1/')) return options.fetch(input, init);
    const blocked = cooldown.get(origin);
    if (blocked && blocked.until > now()) return blocked.response.clone();
    if (blocked) cooldown.delete(origin);
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    const key = JSON.stringify([method, url, [...headers.entries()].sort(), init?.credentials]);
    // Independently abortable reads cannot safely share the owner's AbortSignal.
    const canShare = !init?.signal && !(input instanceof Request);
    const existing = canShare ? pending.get(key) : undefined;
    if (existing) return (await existing).clone();
    const execute = async () => {
      for (let attempt = 0; ; attempt++) {
        let response: Response;
        try { response = await options.fetch(input, init); }
        catch (error) {
          if (attempt >= 1 || init?.signal?.aborted || (error as Error)?.name === 'AbortError') throw error;
          await sleep(500 + Math.floor(random() * 250));
          continue;
        }
        if (![408, 429, 502, 503, 504].includes(response.status)) return response;
        const instructed = retryAfterMs(response.headers.get('Retry-After'), now());
        // Let unrelated widgets fail quickly during an outage rather than amplifying it.
        cooldown.set(origin, { until: now() + Math.max(instructed ?? 0, 5_000), response: new Response(JSON.stringify({ code: 'SERVICE_UNAVAILABLE', message: 'Data is temporarily unavailable. Please retry shortly.' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(Math.max(instructed ?? 0, 5_000) / 1000)) } }) });
        if (attempt >= 1 || (instructed ?? 0) > 5_000) return response;
        const delay = Math.max(instructed ?? 0, 500 + Math.floor(random() * 250));
        await response.body?.cancel();
        await sleep(delay);
      }
    };
    const request = execute();
    if (canShare) pending.set(key, request);
    try { return (await request).clone(); }
    finally { if (canShare && pending.get(key) === request) pending.delete(key); }
  };
}
