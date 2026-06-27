'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { ModuleDashboardLayout } from '../ModuleDashboardLayout';
import { ModuleDashboardActions } from '../ModuleDashboardActions';
import { MetricCard } from '../MetricCard';
import { DashboardLineChart } from '../DashboardLineChart';
import { DashboardBarChart } from '../DashboardBarChart';
import { BreakdownBars } from '../BreakdownBars';
import { StatusDonut } from '../StatusDonut';
import { StatusPills } from '../StatusPills';
import { ActivityFeed } from '../ActivityFeed';
import { DashboardSkeleton } from '../DashboardSkeleton';
import type { OverviewStatsResponse } from '@/types/dashboardStats';
import { DASHBOARD_COLORS } from '@/types/dashboardStats';
import type { ModuleDashboardId } from '@/config/moduleDashboardActions';
import { resolveModuleActions } from '@/config/moduleDashboardActions';
import { cn } from '@/lib/utils';
import { Info, ChevronRight } from 'lucide-react';

interface ModuleDashboardViewProps {
  moduleId: ModuleDashboardId;
  endpoint: string;
  chartType?: 'line' | 'bar' | 'dual-bar';
  chartColor?: string;
  valuePrefix?: string;
  dualBar?: boolean;
  overview?: boolean;
  chartTitle?: string;
  chartSubtitle?: string;
  breakdownTitle?: string;
  breakdownSubtitle?: string;
}

function DashboardContent({
  moduleId,
  endpoint,
  chartType = 'line',
  chartColor,
  valuePrefix,
  dualBar = false,
  overview = false,
  chartTitle,
  chartSubtitle,
  breakdownTitle,
  breakdownSubtitle,
}: ModuleDashboardViewProps) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const { data, loading, error } = useDashboardStats(currentTenant?.id, endpoint);

  if (loading && !data) {
    return (
      <>
        <ModuleDashboardActions moduleId={moduleId} userRole={user?.role} />
        <p className="text-xs text-slate-500 mb-4 px-1">Loading charts…</p>
        <DashboardSkeleton />
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <ModuleDashboardActions moduleId={moduleId} userRole={user?.role} />
        <div className="bg-surface-1 rounded-lg p-8 text-center">
          <p className="text-sm text-slate-300">Could not load dashboard charts</p>
          <p className="text-xs text-slate-500 mt-2">{error || 'No data available'}</p>
          <p className="text-xs text-slate-500 mt-3">Use the actions above to open the workspace and keep working.</p>
        </div>
      </>
    );
  }

  const overviewData = overview ? (data as OverviewStatsResponse) : null;
  const { actions } = resolveModuleActions(moduleId, user?.role ?? 'client');
  const workspaceAction = actions.find((a) => a.primary) ?? actions[0];

  return (
    <div className={cn('ac-scroll-full ac-module-section', loading ? 'opacity-80 transition-opacity' : '')}>
      <ModuleDashboardActions moduleId={moduleId} userRole={user?.role} showChartNote />
      <div
        className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3"
        role="note"
        aria-label="Overview page guidance"
      >
        <div className="flex gap-3 min-w-0">
          <Info className="w-5 h-5 shrink-0 text-teal-400 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium text-slate-100">Overview — read-only snapshot</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Charts and metrics update automatically. To add, edit, or send anything, open the workspace.
            </p>
          </div>
        </div>
        {workspaceAction ? (
          <button
            type="button"
            onClick={() => router.push(workspaceAction.resolvedHref)}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
          >
            {workspaceAction.label}
            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <ModuleDashboardLayout
        row1={data.metrics.map((m) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            delta={m.delta}
            deltaDir={m.deltaDir}
            deltaColor={m.deltaColor}
            comparisonText={m.comparisonText}
          />
        ))}
        row1Extra={
          overviewData?.metricsRowB
            ? overviewData.metricsRowB.map((m) => (
                <MetricCard
                  key={m.label}
                  label={m.label}
                  value={m.value}
                  delta={m.delta}
                  deltaDir={m.deltaDir}
                  deltaColor={m.deltaColor}
                  comparisonText={m.comparisonText}
                />
              ))
            : undefined
        }
        row2={
          <>
            {chartType === 'line' ? (
              <DashboardLineChart
                data={data.mainChart}
                color={chartColor}
                valuePrefix={valuePrefix}
                title={chartTitle}
                subtitle={chartSubtitle}
              />
            ) : (
              <DashboardBarChart
                data={data.mainChart}
                color={chartColor}
                dual={dualBar}
                valuePrefix={valuePrefix}
                title={chartTitle}
                subtitle={chartSubtitle}
              />
            )}
            <BreakdownBars
              items={data.breakdown}
              title={breakdownTitle}
              subtitle={breakdownSubtitle}
            />
          </>
        }
        row3={
          <>
            <StatusDonut
              segments={data.donut}
              title="Status mix"
              subtitle="Where records sit today"
            />
            <StatusPills
              items={overviewData?.platformHealth ?? data.pills}
              title={overview ? 'Module health' : 'Quick status'}
              subtitle="Green = healthy, amber/red = needs action"
            />
            <ActivityFeed
              items={data.feed}
              title="Recent activity"
              subtitle="Latest changes — open workspace to act on these"
            />
          </>
        }
      />
    </div>
  );
}

export function ModuleDashboardView(props: ModuleDashboardViewProps) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent {...props} />
    </Suspense>
  );
}

export function OverviewDashboard() {
  return (
    <ModuleDashboardView
      moduleId="overview"
      endpoint="/api/dashboard/overview"
      chartType="line"
      chartColor={DASHBOARD_COLORS.green}
      valuePrefix="$"
      overview
      chartTitle="Revenue trend"
      chartSubtitle="Invoiced last 6 months"
      breakdownTitle="Module activity"
      breakdownSubtitle="Where work is happening"
    />
  );
}

export function CrmDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams?.get('quickAdd') === 'true') {
      router.replace('/dashboard/crm/workspace?quickAdd=true');
    }
  }, [router, searchParams]);

  return (
    <ModuleDashboardView
      moduleId="crm"
      endpoint="/api/crm/stats"
      chartType="line"
      chartColor={DASHBOARD_COLORS.blue}
      chartTitle="Deals closed"
      chartSubtitle="Won deals by month"
      breakdownTitle="Pipeline stages"
      breakdownSubtitle="Open deals by stage"
    />
  );
}

export function OutreachDashboard() {
  return (
    <ModuleDashboardView
      moduleId="outreach"
      endpoint="/api/outreach/stats"
      chartType="line"
      chartColor={DASHBOARD_COLORS.amber}
      chartTitle="Emails sent"
      chartSubtitle="Last 14 days"
      breakdownTitle="Channels"
      breakdownSubtitle="Outreach by channel"
    />
  );
}

export function InvoicingDashboard() {
  return (
    <ModuleDashboardView
      moduleId="invoicing"
      endpoint="/api/invoices/stats"
      chartType="bar"
      chartColor={DASHBOARD_COLORS.blue}
      dualBar
      valuePrefix="$"
      chartTitle="Invoiced vs collected"
      chartSubtitle="Monthly comparison"
      breakdownTitle="Top clients"
      breakdownSubtitle="By invoice value"
    />
  );
}

export function ContractsDashboard() {
  return (
    <ModuleDashboardView
      moduleId="contracts"
      endpoint="/api/contracts/stats"
      chartType="line"
      chartColor={DASHBOARD_COLORS.blue}
      chartTitle="Contracts signed"
      chartSubtitle="Signed per month"
      breakdownTitle="Contract types"
      breakdownSubtitle="Active portfolio mix"
    />
  );
}

export function ProjectsDashboard() {
  return (
    <ModuleDashboardView
      moduleId="projects"
      endpoint="/api/projects/stats"
      chartType="bar"
      chartColor={DASHBOARD_COLORS.amber}
      chartTitle="Tasks completed"
      chartSubtitle="Weekly completions"
      breakdownTitle="Open tasks"
      breakdownSubtitle="By project"
    />
  );
}

export function SocialDashboard() {
  return (
    <ModuleDashboardView
      moduleId="social"
      endpoint="/api/social/stats"
      chartType="line"
      chartColor={DASHBOARD_COLORS.red}
      chartTitle="Posts published"
      chartSubtitle="Last 14 days"
      breakdownTitle="Platforms"
      breakdownSubtitle="Posts by network"
    />
  );
}
