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
  pillsTitle?: string;
  pillsSubtitle?: string;
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
  pillsTitle,
  pillsSubtitle,
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
              title={pillsTitle || (overview ? 'Module health' : 'Quick status')}
              subtitle={pillsSubtitle || "System integrity snapshot"}
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
      chartColor={DASHBOARD_COLORS.amber}
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
      chartTitle="Closed deals"
      chartSubtitle="Monthly record of wins"
      breakdownTitle="Pipeline stages"
      breakdownSubtitle="Open deals by stage"
      pillsTitle="Team performance"
      pillsSubtitle="Deals by representative"
      overview={false}
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
      chartTitle="Outreach activity"
      chartSubtitle="Sent volume trends"
      breakdownTitle="Channel mix"
      breakdownSubtitle="Outreach by provider"
      pillsTitle="Lead sentiment"
      pillsSubtitle="Based on reply quality"
    />
  );
}

export function InvoicingDashboard() {
  return (
    <ModuleDashboardView
      moduleId="invoicing"
      endpoint="/api/invoices/stats"
      chartType="bar"
      chartColor={DASHBOARD_COLORS.amber}
      dualBar
      valuePrefix="$"
      chartTitle="Revenue collection"
      chartSubtitle="Invoiced vs Actual Collected"
      breakdownTitle="Client contribution"
      breakdownSubtitle="Top revenue drivers"
      pillsTitle="Payment methods"
      pillsSubtitle="Channel distribution"
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
      chartTitle="Portfolio signature"
      chartSubtitle="Monthly execution trends"
      breakdownTitle="Legal structure mix"
      breakdownSubtitle="Active agreement distribution"
      pillsTitle="Agreement health"
      pillsSubtitle="Signature status audit"
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
      chartTitle="Operational velocity"
      chartSubtitle="Weekly task completion"
      breakdownTitle="Project load"
      breakdownSubtitle="Open tasks per project"
      pillsTitle="Priority audit"
      pillsSubtitle="Risk distribution"
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
      chartTitle="Content reach"
      chartSubtitle="Daily impression trends"
      breakdownTitle="Network share"
      breakdownSubtitle="Posts per platform"
      pillsTitle="Content mix"
      pillsSubtitle="Media type distribution"
    />
  );
}
