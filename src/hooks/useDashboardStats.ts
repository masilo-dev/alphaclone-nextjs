'use client';

import { useEffect, useState } from 'react';
import type { DashboardStatsResponse } from '@/types/dashboardStats';
import { resolveHubFromEndpoint } from '@/lib/dashboard/hubKpi';
import type { SlimHubStats } from '@/lib/dashboard/hubKpi';

const CLIENT_CACHE_MS = 5 * 60_000;

function cacheKey(endpoint: string, tenantId: string) {
  return `ac_dash_stats:${endpoint}:${tenantId}`;
}

function readClientCache(endpoint: string, tenantId: string): DashboardStatsResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(endpoint, tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: DashboardStatsResponse };
    if (Date.now() - parsed.at > CLIENT_CACHE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeClientCache(endpoint: string, tenantId: string, data: DashboardStatsResponse) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(cacheKey(endpoint, tenantId), JSON.stringify({ at: Date.now(), data }));
  } catch {
    // sessionStorage may be unavailable
  }
}

function slimToFull(slim: SlimHubStats): DashboardStatsResponse {
  return {
    metrics: slim.metrics,
    mainChart: slim.mainChart,
    breakdown: [],
    donut: [],
    pills: [],
    feed: [],
  };
}

function statsUrl(endpoint: string, tenantId: string): string {
  const hub = resolveHubFromEndpoint(endpoint);
  if (hub) {
    return `/api/dashboard/hub-stats?hub=${encodeURIComponent(hub)}&tenantId=${encodeURIComponent(tenantId)}`;
  }
  return `${endpoint}?tenantId=${encodeURIComponent(tenantId)}`;
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
        const raw = (json.stats ?? json.data ?? json) as SlimHubStats | DashboardStatsResponse;
        const stats =
          'breakdown' in raw && Array.isArray(raw.breakdown)
            ? (raw as DashboardStatsResponse)
            : slimToFull(raw as SlimHubStats);
        writeClientCache(endpoint, tenantId, stats);
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
];

export function usePrefetchDashboardStats(tenantId: string | undefined) {
  useEffect(() => {
    if (!tenantId) return;
    prefetchDashboardStats(tenantId, PREFETCH_ENDPOINTS);
  }, [tenantId]);
}

export function useDashboardStats(tenantId: string | undefined, endpoint: string) {
  const [data, setData] = useState<DashboardStatsResponse | null>(() =>
    tenantId ? readClientCache(endpoint, tenantId) : null,
  );
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const cached = readClientCache(endpoint, tenantId);
    if (cached) {
      setData(cached);
    }

    let cancelled = false;
    const controller = new AbortController();
    setIsValidating(true);
    setError(null);

    fetch(statsUrl(endpoint, tenantId), {
      signal: controller.signal,
      credentials: 'include',
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
        const raw = (json.stats ?? json.data ?? json) as SlimHubStats | DashboardStatsResponse;
        const stats =
          'breakdown' in raw && Array.isArray(raw.breakdown)
            ? (raw as DashboardStatsResponse)
            : slimToFull(raw as SlimHubStats);
        setData(stats);
        writeClientCache(endpoint, tenantId, stats);
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
  }, [tenantId, endpoint]);

  const loading = !data && isValidating;

  return { data, loading, isValidating: isValidating && !!data, error };
}
