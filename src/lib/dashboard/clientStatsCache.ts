const FRESH_MS = 60_000;
const RETAIN_MS = 5 * 60_000;
const PREFIX = 'ac_dash_stats:v2:';
let generation = 0;
const pending = new Map<string, Promise<unknown>>();

export function statsRequestKey(userId: string, tenantId: string, url: string) {
  return `${PREFIX}${JSON.stringify([userId, tenantId, url])}`;
}

export function readSavedStats<T>(key: string): { at: number; data: T } | undefined {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved && typeof saved.at === 'number' && Date.now() - saved.at < RETAIN_MS) return saved;
  } catch { /* Storage is optional. */ }
}

export function clearSavedStats(tenantId?: string) {
  generation++;
  pending.clear();
  if (typeof sessionStorage === 'undefined') return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PREFIX) && (!tenantId || JSON.parse(key.slice(PREFIX.length))[1] === tenantId)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage is optional. */ }
}

/** Prefetch and mounted screens share the same authenticated read. */
export async function loadSavedStats<T>(key: string, url: string, force = false): Promise<T> {
  const saved = readSavedStats<T>(key);
  if (!force && saved && Date.now() - saved.at < FRESH_MS) return saved.data;
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const epoch = generation;
  const request = fetch(url, { credentials: 'include', cache: 'no-store' })
    .then(async response => {
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Failed to load dashboard data');
      const data = json.stats ?? json.data ?? json;
      // An old login/tenant request must never repopulate cleared storage.
      if (epoch !== generation) throw new Error('Dashboard context changed');
      try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* Optional. */ }
      return data as T;
    }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
  pending.set(key, request);
  return request;
}
