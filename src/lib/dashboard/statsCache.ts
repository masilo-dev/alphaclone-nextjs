const CACHE_MS = 120_000;
const MAX_ENTRIES = 256;
const store = new Map<string, { expires: number; data: unknown }>();
const pending = new Map<string, Promise<unknown>>();

export function getStatsCache<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit || hit.expires <= Date.now()) {
    if (hit) store.delete(key);
    return null;
  }
  return hit.data as T;
}

export function setStatsCache(key: string, data: unknown): void {
  if (!store.has(key) && store.size >= MAX_ENTRIES) store.delete(store.keys().next().value!);
  store.set(key, { expires: Date.now() + CACHE_MS, data });
}

/** Share concurrent reads; invalidation prevents an older read restoring stale data. */
export async function getOrLoadStatsCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = getStatsCache<T>(key);
  if (cached !== null) return cached;
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const request = Promise.resolve().then(loader).then(data => {
    if (pending.get(key) === request && !(data instanceof Response)) setStatsCache(key, data);
    return data;
  }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
  pending.set(key, request);
  return request;
}

export function clearStatsCache(prefix?: string): void {
  if (!prefix) { store.clear(); pending.clear(); return; }
  for (const key of store.keys()) if (key.includes(prefix)) store.delete(key);
  for (const key of pending.keys()) if (key.includes(prefix)) pending.delete(key);
}

export function clearStatsCacheForTenant(tenantId: string): void { clearStatsCache(tenantId); }
