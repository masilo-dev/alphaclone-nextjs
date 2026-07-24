'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckSquare,
  ClipboardList,
  GitBranch,
  Inbox,
  Loader2,
  MessageSquare,
  RefreshCw,
  ScrollText,
} from 'lucide-react';

export type BonnieWorkspaceView =
  | 'chat'
  | 'plan'
  | 'graph'
  | 'activity'
  | 'approvals'
  | 'interventions'
  | 'audit'
  | 'results';

const VIEWS: Array<{ id: BonnieWorkspaceView; label: string; icon: React.ElementType }> = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'plan', label: 'Plan', icon: ClipboardList },
  { id: 'graph', label: 'Task Graph', icon: GitBranch },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare },
  { id: 'interventions', label: 'Interventions', icon: Inbox },
  { id: 'audit', label: 'Audit', icon: ScrollText },
  { id: 'results', label: 'Results', icon: CheckSquare },
];

type Props = {
  tenantId: string;
  view: BonnieWorkspaceView;
  onChangeView: (view: BonnieWorkspaceView) => void;
  selectedRunId?: string | null;
  onSelectRun?: (runId: string | null) => void;
  /** When view is chat, parent renders the chat panel instead */
  chatSlot?: React.ReactNode;
};

export default function BonnieWorkspaceViews({
  tenantId,
  view,
  onChangeView,
  selectedRunId,
  onSelectRun,
  chatSlot,
}: Props) {
  const [detail, setDetail] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const loadRuns = useCallback(async () => {
    const res = await fetch(`/api/bonnie/runtime/runs?tenantId=${encodeURIComponent(tenantId)}`, {
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    setRuns(data.runs || []);
    return data.runs || [];
  }, [tenantId]);

  const loadDetail = useCallback(
    async (runId: string) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/bonnie/runtime/runs/${runId}?tenantId=${encodeURIComponent(tenantId)}`,
          { credentials: 'include' }
        );
        const data = await res.json().catch(() => null);
        setDetail(data);
        onSelectRun?.(runId);
      } finally {
        setLoading(false);
      }
    },
    [tenantId, onSelectRun]
  );

  useEffect(() => {
    if (view === 'chat') return;
    void (async () => {
      setLoading(true);
      try {
        const list = await loadRuns();
        const prefer = selectedRunId || list[0]?.id;
        if (prefer) await loadDetail(prefer);
        else setDetail(null);
      } finally {
        setLoading(false);
      }
    })();
    // Refresh when switching operational views for this tenant.
  }, [view, tenantId, loadRuns, loadDetail, selectedRunId]);

  const tasks = detail?.graph?.tasks || [];
  const timeline = detail?.timeline || [];
  const interventions = detail?.interventions || [];
  const progress = detail?.progress;
  const verification = progress?.verification || detail?.progress?.verification;

  const planTasks = useMemo(
    () =>
      [...tasks].sort((a: any, b: any) =>
        String(a.created_at || '').localeCompare(String(b.created_at || ''))
      ),
    [tasks]
  );

  const decide = async (approvalId: string, decision: 'approved' | 'rejected') => {
    if (!detail?.run?.id) return;
    setActing(true);
    try {
      await fetch(`/api/bonnie/runtime/runs/${detail.run.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, approvalId, decision }),
      });
      await loadDetail(detail.run.id);
    } finally {
      setActing(false);
    }
  };

  const cancelRun = async () => {
    if (!detail?.run?.id) return;
    setActing(true);
    try {
      await fetch(`/api/bonnie/runtime/runs/${detail.run.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, cancel: true, reason: 'Cancelled from Bonnie workspace' }),
      });
      await loadDetail(detail.run.id);
      await loadRuns();
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-2 py-2 dark:border-slate-800 dark:bg-slate-950">
        {VIEWS.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChangeView(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                active
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
        {view !== 'chat' && (
          <button
            type="button"
            onClick={() => {
              if (selectedRunId || detail?.run?.id) void loadDetail(selectedRunId || detail.run.id);
              else void loadRuns();
            }}
            className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
            aria-label="Refresh view"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {view === 'chat' ? (
        <div className="relative min-h-0 flex-1">{chatSlot}</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500">Active run</label>
            <select
              className="max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
              value={detail?.run?.id || ''}
              onChange={(e) => {
                const id = e.target.value;
                if (id) void loadDetail(id);
              }}
            >
              <option value="">Select a durable run…</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title?.slice(0, 80) || r.id} ({r.status})
                </option>
              ))}
            </select>
            {detail?.run?.id && (
              <button
                type="button"
                disabled={acting}
                onClick={() => void cancelRun()}
                className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
              >
                Cancel run
              </button>
            )}
          </div>

          {!detail?.run && !loading && (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
              No durable run selected. Start an objective in Chat or create an invoice collection run
              with the durable runtime enabled on Railway.
            </p>
          )}

          {loading && <p className="text-xs text-slate-500">Loading run state…</p>}

          {detail?.run && view === 'plan' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Operational plan
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{detail.run.description}</p>
              <p className="text-xs text-slate-500">
                Mode: {detail.run.execution_mode} · Progress: {Math.round(Number(detail.run.progress_pct) || 0)}%
              </p>
              <ol className="space-y-2">
                {planTasks.map((t: any, idx: number) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800"
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {idx + 1}. {t.title}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {t.assigned_agent_id || 'unassigned'} · {String(t.status).replace(/_/g, ' ')} ·{' '}
                      {t.risk_level || 'low'} risk
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {detail?.run && view === 'graph' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Task graph</h3>
              <p className="text-xs text-slate-500">{progress?.summary}</p>
              <ul className="space-y-2">
                {tasks.map((t: any) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800"
                  >
                    <GitBranch className="mt-0.5 h-3.5 w-3.5 text-teal-600" />
                    <div>
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {String(t.status).replace(/_/g, ' ')}
                        {t.assigned_agent_id ? ` · ${t.assigned_agent_id}` : ''}
                        {t.task_type ? ` · ${t.task_type}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail?.run && view === 'activity' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Activity timeline</h3>
              <ul className="space-y-2">
                {timeline.length === 0 && (
                  <li className="text-xs text-slate-500">No transitions recorded yet.</li>
                )}
                {timeline.map((row: any) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                  >
                    <span className="font-medium">
                      {row.from_state} → {row.to_state}
                    </span>
                    {row.trigger ? ` · ${row.trigger}` : ''}
                    {row.reason ? ` · ${row.reason}` : ''}
                    <div className="text-[10px] text-slate-400">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail?.run && view === 'approvals' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Pending durable approvals</h3>
              <p className="text-xs text-slate-500">
                Approvals pause side effects until you decide. Stale approvals are rejected after data changes.
              </p>
              <ul className="space-y-2">
                {tasks
                  .filter((t: any) => t.status === 'WAITING_FOR_APPROVAL')
                  .map((t: any) => (
                    <li
                      key={t.id}
                      className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-3 dark:border-amber-900 dark:bg-amber-950/20"
                    >
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-[11px] text-slate-500">{t.assigned_agent_id}</p>
                    </li>
                  ))}
                {tasks.filter((t: any) => t.status === 'WAITING_FOR_APPROVAL').length === 0 && (
                  <li className="text-xs text-slate-500">No tasks waiting for approval on this run.</li>
                )}
              </ul>
              {(detail.approvals || []).map((a: any) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.proposed_action?.title || a.id}</p>
                    <p className="text-[11px] text-slate-500">{a.status}</p>
                  </div>
                  {a.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => void decide(a.id, 'approved')}
                        className="rounded-lg bg-teal-600 px-2.5 py-1 text-xs text-white"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => void decide(a.id, 'rejected')}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {detail?.run && view === 'interventions' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Intervention inbox</h3>
              <ul className="space-y-2">
                {interventions.length === 0 && (
                  <li className="text-xs text-slate-500">No open interventions for this run.</li>
                )}
                {interventions.map((i: any) => (
                  <li
                    key={i.id}
                    className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800"
                  >
                    <p className="text-sm font-medium">{i.title}</p>
                    <p className="text-xs text-slate-500">{i.category}</p>
                    {i.detail && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{i.detail}</p>}
                    {i.suggested_resolution && (
                      <p className="mt-1 text-[11px] text-teal-700 dark:text-teal-300">
                        {i.suggested_resolution}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail?.run && view === 'audit' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Audit trail</h3>
              <p className="text-xs text-slate-500">
                State transitions are the authoritative audit for this run. Sensitive payloads are not shown.
              </p>
              <ul className="max-h-[60vh] space-y-1 overflow-y-auto font-mono text-[11px]">
                {timeline.map((row: any) => (
                  <li key={row.id} className="border-b border-slate-100 py-1.5 dark:border-slate-900">
                    [{row.created_at}] {row.entity_type}/{row.entity_id?.slice?.(0, 8)}{' '}
                    {row.from_state}→{row.to_state} ({row.trigger || '—'}) actor={row.actor_type || 'system'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail?.run && view === 'results' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Verified results</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {verification?.summary || progress?.summary || 'Verification pending until tasks settle.'}
              </p>
              {verification?.outcome && (
                <p className="text-xs font-medium uppercase tracking-wide text-teal-700 dark:text-teal-300">
                  Outcome: {verification.outcome}
                </p>
              )}
              <ul className="space-y-2">
                {(verification?.checks || []).map((c: any) => (
                  <li
                    key={c.name}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                  >
                    <span className={c.passed ? 'text-teal-700' : 'text-rose-700'}>
                      {c.passed ? 'PASS' : 'FAIL'}
                    </span>{' '}
                    {c.name}
                    {c.detail ? ` — ${c.detail}` : ''}
                  </li>
                ))}
              </ul>
              <ul className="space-y-1 text-xs text-slate-500">
                {tasks
                  .filter((t: any) => t.status === 'COMPLETED' || t.status === 'FAILED')
                  .map((t: any) => (
                    <li key={t.id}>
                      {t.title}: {String(t.status).replace(/_/g, ' ')}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
