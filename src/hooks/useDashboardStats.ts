'use client';

import { useEffect, useState } from 'react';
import type { DashboardStatsResponse, OverviewStatsResponse } from '@/types/dashboardStats';
import { resolveHubFromEndpoint } from '@/lib/dashboard/hubKpi';
import type { SlimHubStats } from '@/lib/dashboard/hubKpi';

const CLIENT_CACHE_MS = 5 * 60_000;

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

/** Warm sessionStorage cache for overview + common hub stats. */
export function prefetchDashboardStats(tenantId: string, endpoints: string[]) {
  if (typeof window === 'undefined' || !tenantId) return;
  for (const endpoint of endpoints) {
    if (readClientCache(endpoint, tenantId)) continue;
    void fetch(statsUrl(endpoint, tenantId), { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        const raw = (json.stats ?? json.data ?? json) as SlimHubStats | OverviewStatsResponse;
        writeClientCache(endpoint, tenantId, normalizeHubStats(raw));
      })
      .catch(() => undefined);
  }
}

const PREFETCH_ENDPOINTS = [
  '/api/dashboard/overview',
  '/api/crm/stats',
  '/api/outreach/stats',
  '/api/invoices/stats',
  '/api/contracts/stats',
  '/api/projects/stats',
  '/api/social/stats',
  '/api/deals/stats',
  '/api/tasks/stats',
  '/api/quotes/stats',
  '/api/leads/stats',
  '/api/calendar/stats',
  '/api/accounting/stats',
  '/api/campaigns/stats',
];

export function usePrefetchDashboardStats(tenantId: string | undefined) {
  useEffect(() => {
    if (!tenantId) return;
    prefetchDashboardStats(tenantId, PREFETCH_ENDPOINTS);
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

    fetch(statsUrl(endpoint, tenantId, period), {
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
        if (cancelled) return;
        const raw = (json.stats ?? json.data ?? json) as SlimHubStats | OverviewStatsResponse;
        const stats = normalizeHubStats(raw);
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

  const loading = !data && isValidating;

  return { data, loading, isValidating: isValidating && !!data, error };
}
