'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

type McpMonitorResponse = {
  since: string;
  summary: { totalCalls: number; successes: number; failures: number; successRate: number };
  topTools: Array<{ tool: string; total: number; failed: number }>;
  recentFailures: Array<{ tool: string; when: string; reason: string }>;
  recentSessions: Array<{
    id: string;
    tool_name: string;
    success: boolean;
    duration_ms: number | null;
    error_message: string | null;
    created_at: string;
  }>;
};

const metricLabel = 'text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--ws-text-tertiary)]';

export function SuperAdminMcpSessionsTab() {
  const [data, setData] = useState<McpMonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/mcp-sessions?hours=24');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load MCP sessions');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[22px] font-bold leading-7 tracking-tight text-[var(--ws-text-primary)]">
            <Activity className="h-6 w-6 text-[var(--brand-teal)]" aria-hidden="true" />
            MCP & ChatGPT Monitor
          </h2>
          <p className="text-sm text-[var(--ws-text-secondary)]">Tool calls from ChatGPT, Cursor, Claude, and Bonnie MCP — last 24 hours</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="ac-workspace-action-btn inline-flex items-center gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {loading ? <p className="text-sm text-[var(--ws-text-tertiary)]" role="status">Loading MCP activity…</p> : null}
      {error ? <p className="text-sm text-[var(--danger)]" role="alert">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="ac-workspace-panel p-4">
              <p className={metricLabel}>Total calls</p>
              <p className="text-[28px] font-bold leading-[34px] tabular-nums text-[var(--ws-text-primary)]">{data.summary.totalCalls}</p>
            </div>
            <div className="ac-workspace-panel p-4">
              <p className={metricLabel}>Success rate</p>
              <p className="text-[28px] font-bold leading-[34px] tabular-nums text-[var(--brand-teal)]">{data.summary.successRate}%</p>
            </div>
            <div className="ac-workspace-panel p-4">
              <p className={metricLabel}>Succeeded</p>
              <p className="text-[28px] font-bold leading-[34px] tabular-nums text-[var(--success)]">{data.summary.successes}</p>
            </div>
            <div className="ac-workspace-panel p-4">
              <p className={metricLabel}>Failed</p>
              <p className="text-[28px] font-bold leading-[34px] tabular-nums text-[var(--danger)]">{data.summary.failures}</p>
            </div>
          </div>

          {data.recentFailures.length > 0 ? (
            <div className="ac-workspace-panel space-y-2 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-[var(--danger)]">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Recent failures
              </p>
              <ul className="space-y-2">
                {data.recentFailures.slice(0, 10).map((f, i) => (
                  <li key={`${f.tool}-${i}`} className="border-b border-[var(--ws-border)] pb-2 text-sm last:border-0">
                    <span className="font-mono text-[var(--brand-teal)]">{f.tool}</span>
                    <span className="ml-2 text-xs text-[var(--ws-text-tertiary)]">{f.when}</span>
                    <p className="mt-0.5 text-[var(--ws-text-secondary)]">{f.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="ac-workspace-panel p-4">
              <p className="mb-3 text-xs font-semibold text-[var(--ws-text-tertiary)]">Top tools</p>
              <ul className="space-y-1.5">
                {data.topTools.map((t) => (
                  <li key={t.tool} className="flex justify-between text-sm">
                    <span className="truncate font-mono text-[var(--ws-text-secondary)]">{t.tool}</span>
                    <span className="ml-2 shrink-0 tabular-nums text-[var(--ws-text-tertiary)]">
                      {t.total}{t.failed > 0 ? ` · ${t.failed} fail` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="ac-workspace-panel p-4">
              <p className="mb-3 text-xs font-semibold text-[var(--ws-text-tertiary)]">Latest calls</p>
              <ul className="ios-scroll max-h-80 space-y-1.5 overflow-y-auto">
                {data.recentSessions.slice(0, 25).map((s) => (
                  <li key={s.id} className="flex items-start gap-2 rounded-[var(--ws-radius-control,8px)] p-1.5 text-sm transition-colors hover:bg-[var(--ws-hover)]">
                    {s.success ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <span className="font-mono text-[var(--ws-text-secondary)]">{s.tool_name || 'unknown'}</span>
                      <span className="ml-2 text-xs text-[var(--ws-text-tertiary)]">{s.created_at}</span>
                      {!s.success && s.error_message ? <p className="truncate text-xs text-[var(--danger)]">{s.error_message}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default SuperAdminMcpSessionsTab;
