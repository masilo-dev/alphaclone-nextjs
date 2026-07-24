'use client';

import { useCallback, useEffect, useState } from 'react';

export type BonnieGoalSummary = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  progress_pct: number;
  priority: number;
  execution_mode: string;
  owner_agent_id?: string | null;
  waiting_for?: string | null;
  blocker_reason?: string | null;
  updated_at?: string;
  created_at?: string;
};

export function useBonnieGoals(tenantId?: string | null) {
  const [goals, setGoals] = useState<BonnieGoalSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setGoals([]);
      return [];
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenantId, status: 'open', limit: '20' });
      const res = await fetch(`/api/bonnie/goals?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load goals');
      const list = (data.goals || []) as BonnieGoalSummary[];
      setGoals(list);
      return list;
    } catch (err: any) {
      setError(err?.message || 'Failed to load goals');
      return [];
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createGoal = useCallback(
    async (goal: string, opts?: { executeActions?: boolean }) => {
      if (!tenantId) throw new Error('tenant required');
      const res = await fetch('/api/bonnie/goals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          action: 'create',
          goal,
          executeActions: opts?.executeActions === true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create goal');
      await refresh();
      return data;
    },
    [tenantId, refresh]
  );

  const chaseGoals = useCallback(async () => {
    if (!tenantId) throw new Error('tenant required');
    const res = await fetch('/api/bonnie/goals', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, action: 'chase', limit: 5 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to chase goals');
    await refresh();
    return data;
  }, [tenantId, refresh]);

  const patchGoal = useCallback(
    async (
      goalId: string,
      patch: { cancel?: boolean; resume?: boolean; chase?: boolean; status?: string }
    ) => {
      if (!tenantId) throw new Error('tenant required');
      const res = await fetch(`/api/bonnie/goals/${goalId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to update goal');
      await refresh();
      return data;
    },
    [tenantId, refresh]
  );

  return {
    goals,
    loading,
    error,
    refresh,
    createGoal,
    chaseGoals,
    patchGoal,
    openCount: goals.length,
    awaitingApprovalCount: goals.filter((g) => g.status === 'awaiting_approval').length,
  };
}
