/** Each section settles independently; an optional report cannot blank the sequence list. */
export async function loadWorkspaceSections<T extends string>(params: {
  sections: Record<T, string>; signal?: AbortSignal;
  onData: (section: T, data: Record<string, any>) => void;
  onError: (section: T, error: string) => void;
  fetcher?: typeof fetch;
}) {
  const fetcher = params.fetcher || fetch;
  return Promise.allSettled(Object.entries(params.sections).map(async ([name, url]) => {
    const section = name as T;
    try {
      const signal = params.signal ? AbortSignal.any([params.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
      const response = await fetcher(url as string, { credentials: 'include', signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `${section} could not be loaded`);
      if (!params.signal?.aborted) params.onData(section, payload);
    } catch (error) {
      if (params.signal?.aborted) return;
      params.onError(section, error instanceof Error ? (error.name === 'TimeoutError' ? 'Request timed out. Retry this section.' : error.message) : String(error));
    }
  }));
}
