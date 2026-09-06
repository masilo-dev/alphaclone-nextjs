'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { analyticsService, type AnalyticsData } from '@/services/analyticsService';
import { Loader2, DollarSign, Users, Target, TrendingUp, ChevronRight } from 'lucide-react';
import { EnterprisePageHeader } from '@/components/dashboard/responsive/EnterpriseModuleChrome';
import { useTenantRole } from '@/contexts/TenantContext';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import { DEFAULT_EXECUTIVE_KPI_GOALS } from '@/types/workspacePreferences';

const LEGACY_GOAL_KEY = 'executive-kpi-goals';
const ADMIN_ROLES = new Set(['owner', 'admin', 'tenant_admin', 'super_admin']);

export default function ExecutiveDashboard() {
  const router = useRouter();
  const tenantRole = useTenantRole();
  const canEditGoals = tenantRole != null && ADMIN_ROLES.has(tenantRole);

  const {
    executiveKpiGoals: goals,
    loading: prefsLoading,
    saveExecutiveKpiGoals,
    patchImmediate,
  } = useWorkspacePreferences();

  const [stats, setStats] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const migratedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await analyticsService.getAnalytics('30d');
    setStats(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (prefsLoading || migratedRef.current) return;

    try {
      const raw = localStorage.getItem(LEGACY_GOAL_KEY);
      if (!raw) {
        migratedRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw) as {
        revenue?: number;
        clients?: number;
        projects?: number;
        deals?: number;
      };

      const isDefault =
        goals.revenue === DEFAULT_EXECUTIVE_KPI_GOALS.revenue &&
        goals.clients === DEFAULT_EXECUTIVE_KPI_GOALS.clients &&
        goals.projects === DEFAULT_EXECUTIVE_KPI_GOALS.projects;

      if (isDefault && canEditGoals) {
        const legacyGoals = {
          revenue: parsed.revenue ?? DEFAULT_EXECUTIVE_KPI_GOALS.revenue,
          clients: parsed.clients ?? DEFAULT_EXECUTIVE_KPI_GOALS.clients,
          projects: parsed.projects ?? parsed.deals ?? DEFAULT_EXECUTIVE_KPI_GOALS.projects,
        };
        void patchImmediate({ executiveKpiGoals: legacyGoals });
      }

      localStorage.removeItem(LEGACY_GOAL_KEY);
    } catch {
      localStorage.removeItem(LEGACY_GOAL_KEY);
    } finally {
      migratedRef.current = true;
    }
  }, [prefsLoading, goals, canEditGoals, patchImmediate]);

  const saveGoals = useCallback(
    (next: typeof goals) => {
      if (!canEditGoals) return;
      saveExecutiveKpiGoals(next);
    },
    [canEditGoals, saveExecutiveKpiGoals],
  );

  const pageLoading = loading || prefsLoading;

  // Derived numbers tolerate a missing `stats` so every hook below runs on every
  // render. The loading early-return used to sit above `useMemo`, which changed
  // the hook count between renders and crashed the page (React #310).
  const revenueTotal = stats?.revenue.total ?? 0;
  const clientCount = stats?.users.clients ?? 0;
  const activeProjects = stats?.projects.active ?? 0;
  const revenueGoalPct = Math.min(100, Math.round((revenueTotal / Math.max(goals.revenue, 1)) * 100));
  const clientGoalPct = Math.min(100, Math.round((clientCount / Math.max(goals.clients, 1)) * 100));
  const projectGoalPct = Math.min(100, Math.round((activeProjects / Math.max(goals.projects, 1)) * 100));
  const trendValue = stats && Number.isFinite(stats.revenue.trend) ? stats.revenue.trend : null;

  const kpis = useMemo(
    () => [
      {
        label: 'Revenue vs Goal',
        value: `$${revenueTotal.toLocaleString()}`,
        delta: `${revenueGoalPct}% of goal`,
        deltaDir: (revenueTotal >= goals.revenue ? 'up' : 'down') as 'up' | 'down',
        comparisonText: `Goal: $${goals.revenue.toLocaleString()} · last 30 days`,
        icon: DollarSign,
        href: '/dashboard/business/billing',
      },
      {
        label: 'Client Target',
        value: clientCount,
        delta: `${clientGoalPct}% of goal`,
        deltaDir: (clientCount >= goals.clients ? 'up' : 'down') as 'up' | 'down',
        comparisonText: `Target: ${goals.clients}`,
        icon: Users,
        href: '/dashboard/contacts',
      },
      {
        label: 'Active Projects',
        value: activeProjects,
        delta: `${projectGoalPct}% of goal`,
        deltaDir: (activeProjects >= goals.projects ? 'up' : 'down') as 'up' | 'down',
        comparisonText: `Target: ${goals.projects} active projects`,
        icon: Target,
        href: '/dashboard/business/projects',
      },
      {
        label: 'Revenue Trend',
        value:
          trendValue == null
            ? 'Not tracked'
            : `${trendValue >= 0 ? '+' : ''}${trendValue.toFixed(1)}%`,
        delta: trendValue == null ? 'Unavailable' : `${trendValue >= 0 ? '+' : ''}${trendValue.toFixed(1)}%`,
        deltaDir: (trendValue == null || trendValue >= 0 ? 'up' : 'down') as 'up' | 'down',
        comparisonText: 'vs prior period (analytics service)',
        icon: TrendingUp,
        href: '/dashboard/business/billing',
      },
    ],
    [revenueTotal, clientCount, activeProjects, goals, revenueGoalPct, clientGoalPct, projectGoalPct, trendValue],
  );

  if (pageLoading || !stats) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-slate-800 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-32 bg-slate-800 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const kpiProgress = [revenueGoalPct, clientGoalPct, projectGoalPct, null];

  const kpiColors = ['teal', 'blue', 'emerald', 'amber'] as const;
  const colorMap: Record<string, { bar: string; text: string; bg: string }> = {
    teal:    { bar: 'bg-teal-500',    text: 'text-teal-400',    bg: 'bg-teal-500/10' },
    blue:    { bar: 'bg-blue-500',    text: 'text-blue-400',    bg: 'bg-blue-500/10' },
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    amber:   { bar: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/10' },
  };

  return (
    <div className="p-4 md:p-6 space-y-4 pb-24 ac-scroll-full ac-enterprise-module">
      <EnterprisePageHeader
        moduleKey="executive"
        secondaryActions={[{ label: 'Refresh Data', onClick: load }]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          const color = kpiColors[i];
          const { bar, text, bg } = colorMap[color];
          const progress = kpiProgress[i];
          const isUp = kpi.deltaDir === 'up';

          return (
            <button
              key={i}
              onClick={() => router.push(kpi.href)}
              className="group relative bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 text-left hover:border-white/10 transition-all duration-200 hover:bg-slate-900/80"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${text}`} />
                </div>
                <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-full ${
                  isUp
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-red-500/15 text-red-400'
                }`}>
                  {isUp ? '▲' : '▼'} {kpi.delta}
                </span>
              </div>

              <div className="mb-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">{kpi.label}</div>
                <div className="text-xl font-black text-white">{kpi.value}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{kpi.comparisonText}</div>
              </div>

              {progress !== null && (
                <div className="mt-3 space-y-1">
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${bar}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-600 font-bold">{progress}% of goal</div>
                </div>
              )}

              <ChevronRight className="absolute top-3 right-3 w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">Performance Goals Configuration</h3>
            {!canEditGoals && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                View only
              </span>
            )}
          </div>
          <div className="space-y-4">
            {(['revenue', 'clients', 'projects'] as const).map((key) => (
              <div key={key} className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Target {key}</span>
                  <span className="text-white font-black">{goals[key].toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min={key === 'revenue' ? 1000 : 1}
                  max={key === 'revenue' ? 200000 : 500}
                  step={key === 'revenue' ? 1000 : 1}
                  value={goals[key]}
                  onChange={(e) => saveGoals({ ...goals, [key]: Number(e.target.value) })}
                  disabled={!canEditGoals}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Target ${key}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Success Rate</h3>
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
             <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                   <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                   <circle
                    cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent"
                    strokeDasharray={364}
                    strokeDashoffset={364 - (364 * stats.performance.onTimeDelivery) / 100}
                    className="text-teal-500"
                   />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className="text-2xl font-black text-white">{stats.performance.onTimeDelivery}%</span>
                   <span className="text-[9px] text-slate-500 font-bold uppercase">On-Time</span>
                </div>
             </div>
             <p className="text-[11px] text-slate-400 text-center leading-relaxed">
               System efficiency based on project milestones and automated checkpoints.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
