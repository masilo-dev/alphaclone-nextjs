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
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-teal-400" />
            MCP & ChatGPT Monitor
          </h2>
          <p className="text-sm text-[var(--ws-text-secondary)]">
            Tool calls from ChatGPT, Cursor, Claude, and Bonnie MCP — last 24 hours
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--ws-border)] text-xs font-semibold text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading MCP activity…</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="ac-workspace-panel p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Total calls</p>
              <p className="text-2xl font-black text-white tabular-nums">{data.summary.totalCalls}</p>
            </div>
            <div className="ac-workspace-panel p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Success rate</p>
              <p className="text-2xl font-black text-teal-400 tabular-nums">{data.summary.successRate}%</p>
            </div>
            <div className="ac-workspace-panel p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Succeeded</p>
              <p className="text-2xl font-black text-emerald-400 tabular-nums">{data.summary.successes}</p>
            </div>
            <div className="ac-workspace-panel p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Failed</p>
              <p className="text-2xl font-black text-rose-400 tabular-nums">{data.summary.failures}</p>
            </div>
          </div>

          {data.recentFailures.length > 0 && (
            <div className="ac-workspace-panel p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Recent failures
              </p>
              <ul className="space-y-2">
                {data.recentFailures.slice(0, 10).map((f, i) => (
                  <li key={`${f.tool}-${i}`} className="text-sm border-b border-white/5 pb-2 last:border-0">
                    <span className="font-mono text-teal-300">{f.tool}</span>
                    <span className="text-slate-500 ml-2 text-xs">{f.when}</span>
                    <p className="text-slate-300 mt-0.5">{f.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="ac-workspace-panel p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Top tools</p>
              <ul className="space-y-1.5">
                {data.topTools.map((t) => (
                  <li key={t.tool} className="flex justify-between text-sm">
                    <span className="font-mono text-slate-300 truncate">{t.tool}</span>
                    <span className="text-slate-500 tabular-nums shrink-0 ml-2">
                      {t.total}
                      {t.failed > 0 ? ` · ${t.failed} fail` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="ac-workspace-panel p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Latest calls</p>
              <ul className="space-y-1.5 max-h-80 overflow-y-auto">
                {data.recentSessions.slice(0, 25).map((s) => (
                  <li key={s.id} className="flex items-start gap-2 text-sm">
                    {s.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <span className="font-mono text-slate-300">{s.tool_name || 'unknown'}</span>
                      <span className="text-slate-600 text-xs ml-2">{s.created_at}</span>
                      {!s.success && s.error_message && (
                        <p className="text-xs text-rose-200/80 truncate">{s.error_message}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SuperAdminMcpSessionsTab;
