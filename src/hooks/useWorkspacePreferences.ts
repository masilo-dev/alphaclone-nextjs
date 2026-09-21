'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import {
  DEFAULT_DASHBOARD_HOME_LAYOUT,
  DEFAULT_EXECUTIVE_KPI_GOALS,
  type DashboardHomeLayout,
  type ExecutiveKpiGoals,
  type PeriodClosePreferences,
  type WorkspacePreferencesResponse,
} from '@/types/workspacePreferences';

const DEBOUNCE_MS = 400;

function preferenceCacheKey(tenantId: string): string {
  return `alphaclone:workspace-preferences:${tenantId}`;
}

function readCachedPreferences(tenantId: string): WorkspacePreferencesResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(preferenceCacheKey(tenantId));
    return raw ? (JSON.parse(raw) as WorkspacePreferencesResponse) : null;
  } catch {
    return null;
  }
}

function writeCachedPreferences(tenantId: string, data: WorkspacePreferencesResponse): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(preferenceCacheKey(tenantId), JSON.stringify(data));
  } catch {
    // Storage is an enhancement; the server remains authoritative.
  }
}

async function fetchPreferences(tenantId: string): Promise<WorkspacePreferencesResponse> {
  const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/workspace-preferences`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load workspace preferences');
  }
  return response.json();
}

async function patchPreferences(
  tenantId: string,
  patch: {
    periodClose?: { periodId: string; checked: Record<string, boolean> };
    executiveKpiGoals?: ExecutiveKpiGoals;
    dashboardHomeLayout?: DashboardHomeLayout;
  },
): Promise<WorkspacePreferencesResponse> {
  const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/workspace-preferences`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to save workspace preferences');
  }
  return response.json();
}

export function useWorkspacePreferences() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const [periodClose, setPeriodClose] = useState<PeriodClosePreferences>({});
  const [executiveKpiGoals, setExecutiveKpiGoals] = useState<ExecutiveKpiGoals>(DEFAULT_EXECUTIVE_KPI_GOALS);
  const [dashboardHomeLayout, setDashboardHomeLayout] = useState<DashboardHomeLayout>(DEFAULT_DASHBOARD_HOME_LAYOUT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<{
    periodClose?: { periodId: string; checked: Record<string, boolean> };
    executiveKpiGoals?: ExecutiveKpiGoals;
    dashboardHomeLayout?: DashboardHomeLayout;
  }>({});

  const flushPending = useCallback(async () => {
    if (!tenantId) return;
    const patch = pendingPatchRef.current;
    if (!patch.periodClose && !patch.executiveKpiGoals && !patch.dashboardHomeLayout) return;

    pendingPatchRef.current = {};
    try {
      const updated = await patchPreferences(tenantId, patch);
      writeCachedPreferences(tenantId, updated);
      setPeriodClose(updated.periodClose);
      setExecutiveKpiGoals(updated.executiveKpiGoals);
      setDashboardHomeLayout(updated.dashboardHomeLayout);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    }
  }, [tenantId]);

  const schedulePatch = useCallback(
    (patch: {
      periodClose?: { periodId: string; checked: Record<string, boolean> };
      executiveKpiGoals?: ExecutiveKpiGoals;
      dashboardHomeLayout?: DashboardHomeLayout;
    }) => {
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void flushPending();
      }, DEBOUNCE_MS);
    },
    [flushPending],
  );

  const reload = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    const cached = readCachedPreferences(tenantId);
    if (cached) {
      setPeriodClose(cached.periodClose);
      setExecutiveKpiGoals(cached.executiveKpiGoals);
      setDashboardHomeLayout(cached.dashboardHomeLayout);
    }
    setLoading(!cached);
    setError(null);
    try {
      const data = await fetchPreferences(tenantId);
      writeCachedPreferences(tenantId, data);
      setPeriodClose(data.periodClose);
      setExecutiveKpiGoals(data.executiveKpiGoals);
      setDashboardHomeLayout(data.dashboardHomeLayout);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void reload();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [reload]);

  useEffect(() => {
    if (!tenantId || typeof window === 'undefined') return;
    const onPreferenceUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ tenantId?: string; data?: WorkspacePreferencesResponse }>).detail;
      if (detail?.tenantId !== tenantId || !detail.data) return;
      setPeriodClose(detail.data.periodClose);
      setExecutiveKpiGoals(detail.data.executiveKpiGoals);
      setDashboardHomeLayout(detail.data.dashboardHomeLayout);
      setLoading(false);
    };
    window.addEventListener('alphaclone:workspace-preferences-updated', onPreferenceUpdate);
    return () => window.removeEventListener('alphaclone:workspace-preferences-updated', onPreferenceUpdate);
  }, [tenantId]);

  const savePeriodCloseChecklist = useCallback(
    (periodId: string, checked: Record<string, boolean>, immediate = false) => {
      setPeriodClose((prev) => ({
        ...prev,
        [periodId]: {
          checked,
          updatedAt: new Date().toISOString(),
        },
      }));

      const patch = { periodClose: { periodId, checked } };
      if (immediate) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
        void flushPending();
      } else {
        schedulePatch(patch);
      }
    },
    [flushPending, schedulePatch],
  );

  const saveExecutiveKpiGoals = useCallback(
    (goals: ExecutiveKpiGoals) => {
      setExecutiveKpiGoals(goals);
      schedulePatch({ executiveKpiGoals: goals });
    },
    [schedulePatch],
  );

  const saveDashboardHomeLayout = useCallback(
    async (layout: DashboardHomeLayout) => {
      setDashboardHomeLayout(layout);
      if (tenantId) {
        const cached = readCachedPreferences(tenantId);
        const optimistic = cached ?? { periodClose, executiveKpiGoals, dashboardHomeLayout: layout };
        const nextPreferences = { ...optimistic, dashboardHomeLayout: layout };
        writeCachedPreferences(tenantId, nextPreferences);
        window.dispatchEvent(new CustomEvent('alphaclone:workspace-preferences-updated', { detail: { tenantId, data: nextPreferences } }));
      }
      if (!tenantId) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pendingPatchRef.current = {};
      try {
        const updated = await patchPreferences(tenantId, { dashboardHomeLayout: layout });
        writeCachedPreferences(tenantId, updated);
        setPeriodClose(updated.periodClose);
        setExecutiveKpiGoals(updated.executiveKpiGoals);
        setDashboardHomeLayout(updated.dashboardHomeLayout);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save home layout');
      }
    },
    [executiveKpiGoals, periodClose, tenantId],
  );

  const patchImmediate = useCallback(
    async (patch: {
      periodClose?: { periodId: string; checked: Record<string, boolean> };
      executiveKpiGoals?: ExecutiveKpiGoals;
      dashboardHomeLayout?: DashboardHomeLayout;
    }) => {
      if (!tenantId) return null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pendingPatchRef.current = {};
      const updated = await patchPreferences(tenantId, patch);
      writeCachedPreferences(tenantId, updated);
      setPeriodClose(updated.periodClose);
      setExecutiveKpiGoals(updated.executiveKpiGoals);
      setDashboardHomeLayout(updated.dashboardHomeLayout);
      return updated;
    },
    [tenantId],
  );

  return {
    periodClose,
    executiveKpiGoals,
    dashboardHomeLayout,
    loading,
    error,
    reload,
    savePeriodCloseChecklist,
    saveExecutiveKpiGoals,
    saveDashboardHomeLayout,
    patchImmediate,
  };
}
