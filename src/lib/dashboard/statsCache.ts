const CACHE_MS = 120_000;
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

/** Clear all or tenant-scoped server-side dashboard stats cache entries. */
export function clearStatsCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.includes(prefix)) store.delete(key);
  }
}

/** Bust hub-stats and overview caches for a tenant after CRM/outreach mutations. */
export function clearStatsCacheForTenant(tenantId: string): void {
  clearStatsCache(tenantId);
}
