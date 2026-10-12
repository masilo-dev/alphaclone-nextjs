'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { OverviewStatsResponse } from '@/types/dashboardStats';
import { resolveHubFromEndpoint, type SlimHubStats } from '@/lib/dashboard/hubKpi';
import { useAuth } from '@/contexts/AuthContext';
import { loadSavedStats, readSavedStats, statsRequestKey } from '@/lib/dashboard/clientStatsCache';

function statsUrl(endpoint: string, tenantId: string, period: string): string {
  const hub = resolveHubFromEndpoint(endpoint);
  if (hub) return `/api/dashboard/hub-stats?hub=${encodeURIComponent(hub)}&tenantId=${encodeURIComponent(tenantId)}&period=${encodeURIComponent(period)}`;
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}tenantId=${encodeURIComponent(tenantId)}&period=${encodeURIComponent(period)}`;
}

export function dashboardQueryOptions<T>(tenantId: string, userId: string, endpoint: string, period = 'last_30_days') {
  const url = statsUrl(endpoint, tenantId, period);
  const key = statsRequestKey(userId, tenantId, url);
  const saved = readSavedStats<T>(key);
  return {
    queryKey: ['tenant', tenantId, 'stats', userId, url] as const,
    queryFn: () => loadSavedStats<T>(key, url, true),
    initialData: saved?.data,
    initialDataUpdatedAt: saved?.at,
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    retry: false as const,
  };
}

export function useDashboardRead<T>(tenantId: string | undefined, endpoint: string, period = 'last_30_days') {
  const { user } = useAuth();
  const options = dashboardQueryOptions<T>(tenantId || '', user?.id || '', endpoint, period);
  const query = useQuery({ ...options, enabled: Boolean(tenantId && user?.id) });
  return query;
}

export function useDashboardStats(tenantId: string | undefined, endpoint: string, period = 'last_30_days') {
  const query = useDashboardRead<SlimHubStats | OverviewStatsResponse>(tenantId, endpoint, period);
  const data = useMemo(() => query.data ? { ...query.data,
    breakdown: query.data.breakdown ?? [], donut: query.data.donut ?? [],
    pills: query.data.pills ?? [], feed: query.data.feed ?? [],
  } as OverviewStatsResponse : null, [query.data]);
  return { data, loading: query.isPending, isValidating: query.isFetching && !!data, error: query.error?.message || null };
}

export function usePrefetchDashboardStats(tenantId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!tenantId || !user?.id) return;
    let cancelled = false;
    // Serialize idle work; never flood the database alongside the visible module.
    const warm = async () => {
      for (const endpoint of ['/api/dashboard/stats', '/api/dashboard/overview', '/api/crm/stats', '/api/projects/stats', '/api/invoices/stats']) {
        if (cancelled) return;
        await queryClient.prefetchQuery(dashboardQueryOptions(tenantId, user.id, endpoint));
      }
    };
    const timer = window.setTimeout(() => void warm(), 1500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [tenantId, user?.id, queryClient]);
}
