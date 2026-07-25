'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Database,
  Globe,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';
import { DashboardPanelHeader } from '../DashboardPanelHeader';
import type { LeadFinderStats } from '@/lib/scraper/leadFinderStatsServer';

const STEP_LABELS: Record<string, string> = {
  init: 'Initializing',
  scraping: 'Scraping',
  extracting: 'Extracting',
  enriching: 'Enriching',
  deduplicating: 'Deduplicating',
  scoring: 'Scoring',
  syncing: 'CRM sync',
  done: 'Complete',
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`}
      aria-hidden
    />
  );
}

function PipelineBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 font-medium tabular-nums">
          {value.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function LeadFinderSystemPanel({ compact = false }: { compact?: boolean }) {
  const tenant = useCurrentTenantSafe();
  const [stats, setStats] = useState<LeadFinderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scraper-campaigns/stats?tenantId=${encodeURIComponent(tenant.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load stats');
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const panelClass = compact
    ? 'ac-workspace-panel p-4 space-y-4'
    : 'ac-workspace-panel p-5 space-y-5';

  if (loading && !stats) {
    return (
      <div className={panelClass}>
        <DashboardPanelHeader title="System analytics" subtitle="Loading pipeline data…" />
        <div className="h-24 ac-skeleton-pulse rounded-lg bg-slate-800/40" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={panelClass}>
        <DashboardPanelHeader title="System analytics" subtitle="Could not load analytics" />
        <p className="text-xs text-rose-400 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          {error || 'Unknown error'}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  const gradeTotal = Object.values(stats.leads.byGrade).reduce((a, b) => a + b, 0) || stats.leads.total;
  const topSources = Object.entries(stats.sources)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  return (
    <div className={panelClass}>
      <div className="flex items-start justify-between gap-2">
        <DashboardPanelHeader
          title="System analytics"
          subtitle="Real pipeline data for this workspace — not placeholder metrics"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Pipeline funnel */}
      <div className="space-y-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Activity className="w-3 h-3" /> Pipeline
        </p>
        <PipelineBar
          label="Discovered"
          value={stats.pipeline.discovered}
          total={Math.max(stats.pipeline.discovered, 1)}
          color="bg-teal-500"
        />
        <PipelineBar
          label="Enriched / qualified"
          value={stats.pipeline.enriched}
          total={Math.max(stats.pipeline.discovered, 1)}
          color="bg-blue-500"
        />
        <PipelineBar
          label="In CRM"
          value={stats.pipeline.crmSynced}
          total={Math.max(stats.pipeline.discovered, 1)}
          color="bg-indigo-500"
        />
        <PipelineBar
          label="Contacted"
          value={stats.pipeline.contacted}
          total={Math.max(stats.pipeline.discovered, 1)}
          color="bg-emerald-500"
        />
      </div>

      {/* Grade breakdown */}
      {gradeTotal > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Lead grades</p>
          <div className="grid grid-cols-4 gap-2">
            {(['A', 'B', 'C', 'D'] as const).map((g) => (
              <div key={g} className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5 text-center">
                <div className="text-lg font-bold text-white tabular-nums">{stats.leads.byGrade[g] ?? 0}</div>
                <div className="text-[10px] text-slate-500">Grade {g}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data sources */}
      {topSources.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Database className="w-3 h-3" /> Sources
          </p>
          <div className="space-y-1">
            {topSources.map(([source, count]) => (
              <div key={source} className="flex justify-between text-xs">
                <span className="text-slate-400 capitalize">{source.replace(/_/g, ' ')}</span>
                <span className="text-slate-200 tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System health */}
      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Server className="w-3 h-3" /> Infrastructure
        </p>
        <ul className="space-y-1.5 text-xs">
          <li className="flex items-center gap-2 text-slate-300">
            <StatusDot ok={stats.system.leadSearch === 'in-process' || stats.system.leadSearch === 'external'} />
            <Zap className="w-3 h-3 text-slate-500" />
            Lead search:{' '}
            <span className={stats.system.leadSearch === 'in-process' ? 'text-emerald-400' : 'text-blue-400'}>
              {stats.system.leadSearch === 'in-process'
                ? 'In-process (Railway web)'
                : 'External scraper service'}
            </span>
          </li>
          <li className="flex items-center gap-2 text-slate-300">
            <StatusDot ok={stats.system.foursquare === 'configured'} />
            <Globe className="w-3 h-3 text-slate-500" />
            Foursquare:{' '}
            <span className={stats.system.foursquare === 'configured' ? 'text-emerald-400' : 'text-slate-500'}>
              {stats.system.foursquare === 'configured' ? 'Configured' : 'Not configured — OSM only'}
            </span>
          </li>
          <li className="flex items-center gap-2 text-slate-300">
            <StatusDot ok={stats.system.osm === 'available'} />
            <CheckCircle2 className="w-3 h-3 text-slate-500" />
            OpenStreetMap / Overpass: available
          </li>
          <li className="flex items-center gap-2 text-slate-300">
            <StatusDot ok />
            <Globe className="w-3 h-3 text-slate-500" />
            Free stack: Wikidata · Photon · DuckDuckGo
          </li>
          <li className="flex items-center gap-2 text-slate-300">
            <StatusDot ok={stats.system.deepseek === 'configured'} />
            <SparklesIcon />
            DeepSeek (chat parsing):{' '}
            <span className={stats.system.deepseek === 'configured' ? 'text-emerald-400' : 'text-amber-400'}>
              {stats.system.deepseek === 'configured' ? 'Configured' : 'Missing — set DEEPSEEK_API_KEY on Railway web'}
            </span>
          </li>
          <li className="flex items-center gap-2 text-slate-300">
            <StatusDot ok={stats.system.aiProviders === 'available'} />
            <SparklesIcon />
            AI enrichment:{' '}
            <span className={stats.system.aiProviders === 'available' ? 'text-emerald-400' : 'text-amber-400'}>
              {stats.system.aiProviders === 'available' ? 'DeepSeek configured' : 'Set DEEPSEEK_API_KEY on Railway web'}
            </span>
          </li>
        </ul>
      </div>

      {/* Recent runs */}
      {stats.recentRuns.length > 0 && !compact && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recent runs</p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {stats.recentRuns.slice(0, 5).map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between gap-2 text-xs rounded-lg border border-slate-800 px-2 py-1.5"
              >
                <span className="text-slate-400 truncate">
                  {STEP_LABELS[run.currentStep] || run.currentStep}
                </span>
                <span className="text-slate-300 tabular-nums shrink-0">
                  {run.sourceCount} found · {run.progress}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    </svg>
  );
}
