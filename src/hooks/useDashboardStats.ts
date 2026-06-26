'use client';

import { useEffect, useState } from 'react';
import type { DashboardStatsResponse } from '@/types/dashboardStats';

const CLIENT_CACHE_MS = 30_000;

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

export function useDashboardStats(tenantId: string | undefined, endpoint: string) {
  const [data, setData] = useState<DashboardStatsResponse | null>(() =>
    tenantId ? readClientCache(endpoint, tenantId) : null,
  );
  const [loading, setLoading] = useState(() => !data);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const cached = readClientCache(endpoint, tenantId);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    let cancelled = false;
    const controller = new AbortController();

    fetch(`${endpoint}?tenantId=${encodeURIComponent(tenantId)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load stats');
        }
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const stats = (json.stats ?? json.data ?? json) as DashboardStatsResponse;
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
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tenantId, endpoint]);

  return { data, loading: loading && !data, error };
}
