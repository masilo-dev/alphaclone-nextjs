'use client';

import { useEffect, useState, useRef } from 'react';
import type { DashboardStatsResponse, OverviewStatsResponse } from '@/types/dashboardStats';
import { resolveHubFromEndpoint } from '@/lib/dashboard/hubKpi';
import type { SlimHubStats } from '@/lib/dashboard/hubKpi';
import { useOnTabVisible } from '@/lib/sync/tabFocusCoordinator';

const CLIENT_CACHE_MS = 5 * 60_000;
const STALE_THRESHOLD_MS = 30_000;

// Shared in-flight deduplication map so simultaneous callers share a single request
const inFlightRequests = new Map<string, Promise<OverviewStatsResponse>>();

function cacheKey(endpoint: string, tenantId: string, period?: string) {
  return `ac_dash_stats:${endpoint}:${tenantId}:${period ?? 'last_30_days'}`;
}

function readClientCache(endpoint: string, tenantId: string, period?: string): OverviewStatsResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(endpoint, tenantId, period));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: OverviewStatsResponse };
    if (Date.now() - parsed.at > CLIENT_CACHE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeClientCache(endpoint: string, tenantId: string, data: OverviewStatsResponse, period?: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(cacheKey(endpoint, tenantId, period), JSON.stringify({ at: Date.now(), data }));
  } catch {
    // sessionStorage may be unavailable
  }
}

function normalizeHubStats(raw: SlimHubStats | OverviewStatsResponse): OverviewStatsResponse {
  if ('breakdown' in raw && Array.isArray(raw.breakdown)) {
    return raw as OverviewStatsResponse;
  }
  const slim = raw as SlimHubStats;
  return {
    metrics: slim.metrics,
    mainChart: slim.mainChart,
    breakdown: slim.breakdown ?? [],
    donut: slim.donut ?? [],
    pills: slim.pills ?? [],
    feed: slim.feed ?? [],
    metricsRowB: slim.metricsRowB,
    platformHealth: slim.platformHealth,
  };
}

function statsUrl(endpoint: string, tenantId: string, period?: string): string {
  const hub = resolveHubFromEndpoint(endpoint);
  const periodParam = period ? `&period=${encodeURIComponent(period)}` : '';
  if (hub) {
    return `/api/dashboard/hub-stats?hub=${encodeURIComponent(hub)}&tenantId=${encodeURIComponent(tenantId)}${periodParam}`;
  }
  const sep = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${sep}tenantId=${encodeURIComponent(tenantId)}${period ? `&period=${encodeURIComponent(period)}` : ''}`;
}

const CRITICAL_PREFETCH_ENDPOINTS = [
  '/api/dashboard/overview',
  '/api/crm/stats',
];

const SECONDARY_PREFETCH_ENDPOINTS = [
  '/api/invoices/stats',
  '/api/projects/stats',
  '/api/leads/stats',
  '/api/deals/stats',
];

/** Warm sessionStorage cache for overview + primary hub stats without choking network */
export function prefetchDashboardStats(tenantId: string, endpoints: string[] = CRITICAL_PREFETCH_ENDPOINTS) {
  if (typeof window === 'undefined' || !tenantId) return;

  const fetchEndpoint = (endpoint: string) => {
    if (readClientCache(endpoint, tenantId)) return;
    void fetch(statsUrl(endpoint, tenantId), { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        const raw = (json.stats ?? json.data ?? json) as SlimHubStats | OverviewStatsResponse;
        writeClientCache(endpoint, tenantId, normalizeHubStats(raw));
      })
      .catch(() => undefined);
  };

  // 1. Fetch critical endpoints immediately
  for (const endpoint of endpoints) {
    fetchEndpoint(endpoint);
  }

  // 2. Fetch secondary endpoints only when idle, staggered by 300ms
  const scheduleSecondary = () => {
    SECONDARY_PREFETCH_ENDPOINTS.forEach((endpoint, index) => {
      window.setTimeout(() => {
        fetchEndpoint(endpoint);
      }, (index + 1) * 300);
    });
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(scheduleSecondary, { timeout: 4000 });
  } else {
    window.setTimeout(scheduleSecondary, 800);
  }
}

export function usePrefetchDashboardStats(tenantId: string | undefined) {
  useEffect(() => {
    if (!tenantId) return;
    prefetchDashboardStats(tenantId);
  }, [tenantId]);
}

export function useDashboardStats(
  tenantId: string | undefined,
  endpoint: string,
  period: string = 'last_30_days',
) {
  const [data, setData] = useState<OverviewStatsResponse | null>(() =>
    tenantId ? readClientCache(endpoint, tenantId, period) : null,
  );
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !tenantId) return;
    const onInvalidate = (event: Event) => {
      const detail = (event as CustomEvent<{ tenantId?: string }>).detail;
      if (!detail?.tenantId || detail.tenantId === tenantId) {
        try {
          sessionStorage.removeItem(cacheKey(endpoint, tenantId, period));
        } catch {
          /* ignore */
        }
        setRefreshNonce((n) => n + 1);
      }
    };
    window.addEventListener('ac:crm-stats-invalidate', onInvalidate);
    return () => window.removeEventListener('ac:crm-stats-invalidate', onInvalidate);
  }, [tenantId, endpoint, period]);

  useEffect(() => {
    if (!tenantId) return;

    const cached = readClientCache(endpoint, tenantId, period);
    if (cached && refreshNonce === 0) {
      setData(cached);
    }

    let cancelled = false;
    const controller = new AbortController();
    setIsValidating(true);
    setError(null);

    const reqKey = `${endpoint}:${tenantId}:${period}`;
    let reqPromise = inFlightRequests.get(reqKey);
    if (!reqPromise || refreshNonce > 0) {
      reqPromise = fetch(statsUrl(endpoint, tenantId, period), {
        signal: controller.signal,
        credentials: 'include',
        cache: refreshNonce > 0 ? 'no-store' : 'default',
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || 'Failed to load stats');
          }
          return res.json();
        })
        .then((json) => {
          const raw = (json.stats ?? json.data ?? json) as SlimHubStats | OverviewStatsResponse;
          return normalizeHubStats(raw);
        })
        .finally(() => {
          inFlightRequests.delete(reqKey);
        });

      inFlightRequests.set(reqKey, reqPromise);
    }

    reqPromise
      .then((stats) => {
        if (cancelled) return;
        setData(stats);
        writeClientCache(endpoint, tenantId, stats, period);
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AbortError') return;
        if (!cached) {
          setError(err instanceof Error ? err.message : 'Failed to load stats');
        }
      })
      .finally(() => {
        if (!cancelled) setIsValidating(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tenantId, endpoint, period, refreshNonce]);

  // When returning to tab, silently refresh stale dashboard stats in the background without UI flicker
  useOnTabVisible(() => {
    if (!tenantId) return;
    setRefreshNonce((n) => n + 1);
  }, { cooldownMs: 10_000, enabled: !!tenantId });

  const loading = !data && (isValidating || !tenantId);

  return { data, loading, isValidating: isValidating && !!data, error };
}
