import { QueryClient } from '@tanstack/react-query';

const CLIENT_STATS_PREFIX = 'ac_dash_stats:';

/** Clear sessionStorage dashboard stats for a tenant (browser only). */
export function clearDashboardStatsClientCache(tenantId: string): void {
  if (typeof window === 'undefined' || !tenantId) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CLIENT_STATS_PREFIX) && key.includes(tenantId)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) sessionStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent('ac:crm-stats-invalidate', { detail: { tenantId } }));
  } catch {
    /* sessionStorage unavailable */
  }
}

/** Invalidate client/crm caches after delete or restore actions. */
export function invalidateCrmCaches(queryClient?: QueryClient, tenantId?: string) {
  if (tenantId) clearDashboardStatsClientCache(tenantId);
  if (queryClient) {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['crm'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  }
}
