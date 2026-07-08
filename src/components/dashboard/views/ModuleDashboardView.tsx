'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { MetricCard, MetricCardSkeleton } from '../MetricCard';
import { DashboardLineChart } from '../DashboardLineChart';
import { DashboardBarChart } from '../DashboardBarChart';
import { DASHBOARD_COLORS } from '@/types/dashboardStats';
import type { ModuleDashboardId } from '@/config/moduleDashboardActions';
import { resolveModuleActions } from '@/config/moduleDashboardActions';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

interface ModuleDashboardViewProps {
  moduleId: ModuleDashboardId;
  endpoint: string;
  chartType?: 'line' | 'bar' | 'dual-bar';
  chartColor?: string;
  valuePrefix?: string;
  dualBar?: boolean;
  chartTitle?: string;
  chartSubtitle?: string;
}

function ChartSkeleton() {
  return (
    <div className="ac-workspace-panel ac-chart-enter p-5 min-h-[280px] ac-skeleton-pulse">
      <div className="h-3 w-28 bg-slate-800 rounded mb-2" />
      <div className="h-2.5 w-40 bg-slate-800/70 rounded mb-6" />
      <div className="h-[200px] bg-slate-800/40 rounded-lg" />
    </div>
  );
}

function DashboardContent({
  moduleId,
  endpoint,
  chartType = 'line',
  chartColor,
  valuePrefix,
  dualBar = false,
  chartTitle,
  chartSubtitle,
}: ModuleDashboardViewProps) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const { data, loading, isValidating, error } = useDashboardStats(currentTenant?.id, endpoint);

  if (loading && !data) {
    return (
      <div className="space-y-4 ac-scroll-full ac-module-section">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} className="ac-metric-enter" style={{ animationDelay: `${i * 40}ms` } as React.CSSProperties} />
          ))}
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  if (error || !data) {
    const { actions: errActions } = resolveModuleActions(moduleId, user?.role ?? 'client');
    const errWorkspace = errActions.find((a) => a.primary) ?? errActions[0];
    return (
      <div className="ac-scroll-full ac-module-section">
        <div className="ac-workspace-panel p-8 text-center">
          <p className="text-[13px] text-[var(--ws-text-secondary)]">Could not load metrics</p>
          {errWorkspace ? (
            <button
              type="button"
              onClick={() => router.push(errWorkspace.resolvedHref)}
              className="ac-workspace-action-btn ac-workspace-action-btn--primary mt-4"
            >
              {errWorkspace.label}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const { actions } = resolveModuleActions(moduleId, user?.role ?? 'client');
  const workspaceAction = actions.find((a) => a.primary) ?? actions[0];
  const metrics = data.metrics.slice(0, 4);
  const allMetricsZero = metrics.every((m) => Number(m.value) === 0 || m.value === '0' || m.value === '0%');

  return (
    <div className={cn('ac-scroll-full ac-module-section space-y-4', isValidating ? 'opacity-95' : '')}>
      {moduleId === 'overview' && allMetricsZero ? (
        <p className="text-[12px] text-[var(--ws-text-tertiary)] px-0.5">
          No activity yet — use the checklist above to add your first client.
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        {workspaceAction ? (
          <button
            type="button"
            onClick={() => router.push(workspaceAction.resolvedHref)}
            className="ac-workspace-action-btn ac-workspace-action-btn--primary text-[11px] min-h-8 px-2.5"
          >
            {workspaceAction.label}
            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m, i) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            delta={m.delta}
            deltaDir={m.deltaDir}
            deltaColor={m.deltaColor}
            comparisonText={m.comparisonText}
            className="ac-metric-enter ac-metric-card"
            style={{ animationDelay: `${i * 45}ms` } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="ac-chart-enter">
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
      </div>
    </div>
  );
}

export function ModuleDashboardView(props: ModuleDashboardViewProps) {
  return <DashboardContent {...props} />;
}

export function OverviewDashboard() {
  return (
    <ModuleDashboardView
      moduleId="overview"
      endpoint="/api/dashboard/overview"
      chartType="line"
      chartColor={DASHBOARD_COLORS.green}
      valuePrefix="$"
      chartTitle="Revenue"
      chartSubtitle="Last 6 months"
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
      chartSubtitle="Won by month"
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
      chartSubtitle="Monthly"
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
      chartSubtitle="Per month"
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
      chartSubtitle="Weekly"
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
    />
  );
}
