const CACHE_MS = 30_000;
const store = new Map<string, { expires: number; data: unknown }>();

export function getStatsCache<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit || hit.expires <= Date.now()) {
    if (hit) store.delete(key);
    return null;
  }
  return hit.data as T;
}

export function setStatsCache(key: string, data: unknown): void {
  store.set(key, { expires: Date.now() + CACHE_MS, data });
}
