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
  BarChart3,
  Target,
} from 'lucide-react';
import { PlatformKpiGrid, MetricDateRangeSelector } from '@/components/dashboard/metrics';
import { platformKpiFromNumbers } from '@/lib/metrics/metricPresentation';
import { useMetricDateRange } from '@/hooks/useMetricDateRange';
import { periodPresetToDayCount } from '@/lib/metrics/dateRange';

export type BonnieWorkspaceView =
  | 'chat'
  | 'plan'
  | 'graph'
  | 'activity'
  | 'approvals'
  | 'interventions'
  | 'audit'
  | 'results'
  | 'analytics'
  | 'outcomes';

const VIEWS: Array<{ id: BonnieWorkspaceView; label: string; icon: React.ElementType }> = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'plan', label: 'Plan', icon: ClipboardList },
  { id: 'graph', label: 'Task Graph', icon: GitBranch },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare },
  { id: 'interventions', label: 'Interventions', icon: Inbox },
  { id: 'audit', label: 'Audit', icon: ScrollText },
  { id: 'results', label: 'Results', icon: CheckSquare },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'outcomes', label: 'Outcomes', icon: Target },
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
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const { preset: analyticsPreset, setPeriod: setAnalyticsPeriod, comparisonLabel: analyticsComparison } =
    useMetricDateRange('last_30_days');
  const [outcomesCatalog, setOutcomesCatalog] = useState<any[]>([]);
  const [outcomeKey, setOutcomeKey] = useState('content_to_publish');
  const [outcomeExecute, setOutcomeExecute] = useState(false);
  const [outcomeParams, setOutcomeParams] = useState<Record<string, string>>({ caption: '' });
  const [outcomeResult, setOutcomeResult] = useState<any>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);

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
    if (view !== 'analytics') return;
    let cancelled = false;
    setLoading(true);
    setAnalyticsError(null);
    const days = periodPresetToDayCount(analyticsPreset);
    void fetch(`/api/bonnie/analytics?tenantId=${encodeURIComponent(tenantId)}&days=${days}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !payload?.success) {
          setAnalytics(null);
          setAnalyticsError(payload?.error || 'Bonnie analytics could not be loaded');
          return;
        }
        setAnalytics(payload);
      })
      .catch(() => {
        if (!cancelled) setAnalyticsError('Bonnie analytics could not be loaded');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, tenantId, analyticsPreset]);

  useEffect(() => {
    if (view === 'chat' || view === 'analytics') return;
    void (async () => {
      setLoading(true);
      try {
        if (view === 'outcomes') {
          const response = await fetch(`/api/bonnie/outcomes/list?tenantId=${encodeURIComponent(tenantId)}`, { credentials: 'include' });
          const payload = await response.json().catch(() => null);
          setOutcomesCatalog(payload?.outcomes || []);
          setOutcomeResult(null);
          setOutcomeError(null);
          return;
        }
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

  const launchOutcome = async () => {
    setActing(true);
    setOutcomeError(null);
    try {
      const body: Record<string, unknown> = {
        tenantId,
        outcome_key: outcomeKey,
        execute: outcomeExecute,
        ...Object.fromEntries(Object.entries(outcomeParams).filter(([, v]) => v.trim())),
      };
      const res = await fetch('/api/bonnie/outcomes/execute', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) {
        setOutcomeError(payload.error || payload.message || 'Outcome could not be started');
        setOutcomeResult(null);
        return;
      }
      setOutcomeResult(payload);
      if (payload.run_id) {
        onChangeView('graph');
        await loadRuns();
        await loadDetail(payload.run_id);
      }
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
          {view === 'outcomes' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Governed outcomes</h3>
                <p className="text-xs text-slate-500">Launch multi-step missions on the Bonnie durable runtime. Dry-run by default; enable execute for provider writes.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mission</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                  value={outcomeKey}
                  onChange={(e) => setOutcomeKey(e.target.value)}
                >
                  {outcomesCatalog.map((o: any) => (
                    <option key={o.outcome_key} value={o.outcome_key}>{o.title}</option>
                  ))}
                </select>
                <label className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={outcomeExecute} onChange={(e) => setOutcomeExecute(e.target.checked)} />
                  Execute provider writes (publish, send, invoice, schedule)
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    ['caption', 'Caption / content'],
                    ['deal_id', 'Deal ID'],
                    ['invoice_id', 'Invoice ID'],
                    ['client_id', 'Client ID'],
                    ['amount', 'Invoice amount'],
                    ['to', 'Email to'],
                    ['subject', 'Email subject'],
                    ['text', 'Email body'],
                    ['lead_id', 'Lead ID'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-[10px] text-slate-500">{label}</label>
                      <input
                        className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                        value={outcomeParams[key] || ''}
                        onChange={(e) => setOutcomeParams((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => void launchOutcome()}
                  className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {acting ? 'Starting…' : 'Request outcome'}
                </button>
                {outcomeError && <p className="mt-2 text-xs text-rose-600">{outcomeError}</p>}
                {outcomeResult?.run_id && (
                  <p className="mt-2 text-xs text-teal-700">Run {outcomeResult.run_id} · {outcomeResult.steps_planned} steps planned</p>
                )}
              </div>
              <ul className="space-y-2">
                {outcomesCatalog.map((o: any) => (
                  <li key={o.outcome_key} className="rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
                    <p className="font-semibold">{o.title}</p>
                    <p className="text-slate-500">{o.description}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{o.step_count} steps · required: {(o.required_params || []).join(', ') || 'see mission'}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {view === 'analytics' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Agent performance</h3>
                  <p className="text-xs text-slate-500">
                    {analytics?.periodDays ? `Last ${analytics.periodDays} days` : analyticsComparison} · tenant-isolated execution evidence
                  </p>
                </div>
                <MetricDateRangeSelector value={analyticsPreset} onChange={setAnalyticsPeriod} compact />
              </div>
              {loading && !analytics ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
                </div>
              ) : null}
              {analyticsError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  {analyticsError}
                </div>
              ) : null}
              {analytics?.success ? (
                <>
                  <PlatformKpiGrid
                    items={[
                      platformKpiFromNumbers({
                        metricId: 'agents.tool_success_rate',
                        label: 'Tool success',
                        current: Math.round(analytics.tools.successRate * 100),
                        isPercentage: true,
                        formattedValue: `${Math.round(analytics.tools.successRate * 100)}%`,
                        referencePeriod: `${analytics.tools.calls} calls · ${analyticsComparison}`,
                        href: '/dashboard/bonnie',
                      }),
                      platformKpiFromNumbers({
                        label: 'Run success',
                        current: Math.round(analytics.runs.successRate * 100),
                        isPercentage: true,
                        formattedValue: `${Math.round(analytics.runs.successRate * 100)}%`,
                        referencePeriod: `${analytics.runs.completed}/${analytics.runs.total} completed`,
                      }),
                      platformKpiFromNumbers({
                        label: 'Avg latency',
                        current: analytics.tools.averageLatencyMs,
                        formattedValue: `${analytics.tools.averageLatencyMs} ms`,
                        referencePeriod: `p95 ${analytics.tools.p95LatencyMs} ms`,
                        isBetterHigher: false,
                      }),
                      platformKpiFromNumbers({
                        label: 'Pending approvals',
                        current: analytics.approvals.pending,
                        referencePeriod: `${analytics.approvals.decided} decided`,
                        href: '/dashboard/bonnie',
                        isBetterHigher: false,
                      }),
                    ]}
                  />
                  <div className="grid gap-3 lg:grid-cols-2">
                    <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <h4 className="text-xs font-semibold">Tool reliability</h4>
                      <div className="mt-2 max-h-80 overflow-y-auto">
                        <table className="w-full text-left text-[11px]">
                          <thead className="text-slate-500">
                            <tr>
                              <th className="pb-2">Tool</th>
                              <th>Calls</th>
                              <th>Success</th>
                              <th>Latency</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.tools.performance.map((row: { tool: string; calls: number; successRate: number; averageLatencyMs: number }) => (
                              <tr key={row.tool} className="border-t border-slate-100 dark:border-slate-900">
                                <td className="max-w-44 truncate py-1.5">{row.tool}</td>
                                <td>{row.calls}</td>
                                <td className={row.successRate >= 0.9 ? 'text-teal-600' : 'text-amber-600'}>
                                  {Math.round(row.successRate * 100)}%
                                </td>
                                <td>{row.averageLatencyMs} ms</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                    <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <h4 className="text-xs font-semibold">Attributed revenue impact</h4>
                      <div className="mt-3 space-y-2">
                        {Object.entries(analytics.revenueByCurrency as Record<string, number>).length ? (
                          Object.entries(analytics.revenueByCurrency as Record<string, number>).map(([currency, amount]) => (
                            <div key={currency} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
                              <span className="text-xs text-slate-500">{currency}</span>
                              <span className="text-sm font-black text-teal-600">{Number(amount).toLocaleString()}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-500">
                            Revenue attribution will appear when outreach creates deals, contracts or paid invoices.
                          </p>
                        )}
                      </div>
                      <div className="mt-4 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
                        <p className="font-semibold">Estimated model/tool cost</p>
                        <p className="mt-1 text-lg font-black">${Number(analytics.tools.estimatedCostUsd || 0).toFixed(4)}</p>
                      </div>
                    </section>
                  </div>
                  {analytics.executionOutcomes ? (
                    <PlatformKpiGrid
                      header={<p className="text-[11px] font-black uppercase tracking-widest text-slate-400">MCP execution reliability</p>}
                      items={[
                        platformKpiFromNumbers({
                          label: 'Receipt completeness',
                          current: analytics.executionOutcomes.receiptCompletenessPct,
                          isPercentage: true,
                          formattedValue: `${analytics.executionOutcomes.receiptCompletenessPct}%`,
                        }),
                        platformKpiFromNumbers({
                          label: 'First-attempt success',
                          current: Math.round((analytics.executionOutcomes.firstAttemptSuccessRate || 0) * 100),
                          isPercentage: true,
                          formattedValue: `${Math.round((analytics.executionOutcomes.firstAttemptSuccessRate || 0) * 100)}%`,
                        }),
                        platformKpiFromNumbers({
                          label: 'Wrong-target (ambiguous)',
                          current: analytics.executionOutcomes.targetAmbiguousFailures,
                          isBetterHigher: false,
                          href: '/dashboard/bonnie?tab=interventions',
                        }),
                      ]}
                    />
                  ) : null}
                  {analytics.executionAssurance ? (
                    <PlatformKpiGrid
                      header={<p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Execution assurance</p>}
                      items={[
                        platformKpiFromNumbers({
                          label: 'Outcome runs',
                          current: analytics.executionAssurance.outcomeRuns?.total || 0,
                          referencePeriod: `${analytics.executionAssurance.outcomeRuns?.verified_completed || 0} verified`,
                        }),
                        platformKpiFromNumbers({
                          label: 'Write receipt completeness',
                          current: analytics.executionAssurance.receiptCompletenessPct ?? analytics.executionOutcomes?.receiptCompletenessPct ?? 100,
                          isPercentage: true,
                          formattedValue: `${analytics.executionAssurance.receiptCompletenessPct ?? analytics.executionOutcomes?.receiptCompletenessPct ?? 100}%`,
                        }),
                        platformKpiFromNumbers({
                          label: 'Stale pending actions',
                          current: analytics.executionAssurance.externalActions?.stale_pending || 0,
                          isBetterHigher: false,
                        }),
                        platformKpiFromNumbers({
                          label: 'Open receipt issues',
                          current: analytics.executionAssurance.openReceiptIssues || 0,
                          isBetterHigher: false,
                          href: '/dashboard/bonnie?tab=interventions',
                        }),
                      ]}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
