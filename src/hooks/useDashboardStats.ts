'use client';

import { useEffect, useState } from 'react';
import type { DashboardStatsResponse } from '@/types/dashboardStats';

export function useDashboardStats(tenantId: string | undefined, endpoint: string) {
  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${endpoint}?tenantId=${encodeURIComponent(tenantId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load stats');
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json.stats ?? json.data ?? json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load stats');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, endpoint]);

  return { data, loading, error };
}
