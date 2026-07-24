'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, GitBranch, Loader2, RefreshCw } from 'lucide-react';

type RunSummary = {
  id: string;
  title: string;
  status: string;
  progress_pct: number;
  updated_at?: string;
  last_progress_at?: string | null;
};

type Props = {
  tenantId: string;
  onSelectRun?: (runId: string) => void;
};

export default function BonnieRuntimePanel({ tenantId, onSelectRun }: Props) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bonnie/runtime/runs?tenantId=${encodeURIComponent(tenantId)}`, {
        credentials: 'include',
      });
      const data = await res.json();
      setRuns(data.runs || []);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openRun = async (runId: string) => {
    onSelectRun?.(runId);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/bonnie/runtime/runs/${runId}?tenantId=${encodeURIComponent(tenantId)}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      setSelected(data);
    } catch {
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Durable runs
          </p>
          <p className="text-xs text-slate-500">Survives refresh, logout, and deploys</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
          aria-label="Refresh runs"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      {runs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 dark:border-slate-800">
          No durable runs yet. Ask Bonnie for a multi-step objective with durable mode enabled.
        </p>
      ) : (
        <ul className="space-y-2">
          {runs.slice(0, 8).map((run) => (
            <li key={run.id}>
              <button
                type="button"
                onClick={() => void openRun(run.id)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                <div className="flex items-start gap-2">
                  <GitBranch className="mt-0.5 h-3.5 w-3.5 text-teal-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {run.title}
                    </p>
                    <p className="text-[11px] capitalize text-slate-500">
                      {run.status.replace(/_/g, ' ')} · {Math.round(Number(run.progress_pct) || 0)}%
                    </p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full bg-teal-600"
                        style={{ width: `${Math.max(4, Math.min(100, Number(run.progress_pct) || 0))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {detailLoading && (
        <p className="text-xs text-slate-500">Loading graph…</p>
      )}

      {selected?.progress && (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Activity className="h-3.5 w-3.5" /> Activity
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">{selected.progress.summary}</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {(selected.graph?.tasks || []).map((t: any) => (
              <li key={t.id} className="text-[11px] text-slate-500">
                <span className="font-medium text-slate-700 dark:text-slate-200">{t.title}</span>
                {' · '}
                {String(t.status || '').replace(/_/g, ' ')}
                {t.assigned_agent_id ? ` · ${t.assigned_agent_id}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
