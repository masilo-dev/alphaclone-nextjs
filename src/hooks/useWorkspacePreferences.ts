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
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPreferences(tenantId);
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
      if (!tenantId) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pendingPatchRef.current = {};
      try {
        const updated = await patchPreferences(tenantId, { dashboardHomeLayout: layout });
        setPeriodClose(updated.periodClose);
        setExecutiveKpiGoals(updated.executiveKpiGoals);
        setDashboardHomeLayout(updated.dashboardHomeLayout);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save home layout');
      }
    },
    [tenantId],
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
