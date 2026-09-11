type CachedCount = {
  userId: string;
  count: number;
  fetchedAt: number;
};

let cached: CachedCount | null = null;
let inflight: Promise<{ count: number; error: string | null }> | null = null;
let backoffUntil = 0;

const MIN_INTERVAL_MS = 60_000;
const BACKOFF_MS = 180_000;

export function readMissedCallsCache(userId: string): number | null {
  if (!cached || cached.userId !== userId) return null;
  if (Date.now() - cached.fetchedAt > MIN_INTERVAL_MS) return null;
  return cached.count;
}

export async function fetchMissedCallsCountShared(
  fetcher: (userId: string) => Promise<{ count: number; error: string | null }>,
  userId: string
): Promise<{ count: number; error: string | null }> {
  const now = Date.now();
  if (now < backoffUntil) {
    return {
      count: cached?.userId === userId ? cached.count : 0,
      error: null,
    };
  }

  const cachedCount = readMissedCallsCache(userId);
  if (cachedCount != null) {
    return { count: cachedCount, error: null };
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const result = await fetcher(userId);
      const message = String(result.error || '').toLowerCase();
      if (
        result.error &&
        (message.includes('503') ||
          message.includes('schema cache') ||
          message.includes('service unavailable'))
      ) {
        backoffUntil = Date.now() + BACKOFF_MS;
        return { count: cached?.userId === userId ? cached.count : 0, error: null };
      }

      cached = { userId, count: result.count, fetchedAt: Date.now() };
      backoffUntil = 0;
      return result;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
