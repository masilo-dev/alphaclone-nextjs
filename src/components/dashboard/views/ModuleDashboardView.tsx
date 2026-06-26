'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { ModuleDashboardLayout } from '../ModuleDashboardLayout';
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

interface ModuleDashboardViewProps {
  endpoint: string;
  chartType?: 'line' | 'bar' | 'dual-bar';
  chartColor?: string;
  valuePrefix?: string;
  dualBar?: boolean;
  overview?: boolean;
}

function DashboardContent({
  endpoint,
  chartType = 'line',
  chartColor,
  valuePrefix,
  dualBar = false,
  overview = false,
}: ModuleDashboardViewProps) {
  const { currentTenant } = useTenant();
  const { data, loading, error } = useDashboardStats(currentTenant?.id, endpoint);

  if (loading) return <DashboardSkeleton />;
  if (error || !data) {
    return (
      <div className="bg-surface-1 rounded-lg p-8 text-center text-xs text-slate-500">
        {error || 'No data'}
      </div>
    );
  }

  const overviewData = overview ? (data as OverviewStatsResponse) : null;

  return (
    <ModuleDashboardLayout
      row1={data.metrics.map((m) => (
        <MetricCard
          key={m.label}
          label={m.label}
          value={m.value}
          delta={m.delta}
          deltaDir={m.deltaDir}
          deltaColor={m.deltaColor}
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
              />
            ))
          : undefined
      }
      row2={
        <>
          {chartType === 'line' ? (
            <DashboardLineChart data={data.mainChart} color={chartColor} valuePrefix={valuePrefix} />
          ) : (
            <DashboardBarChart
              data={data.mainChart}
              color={chartColor}
              dual={dualBar}
              valuePrefix={valuePrefix}
            />
          )}
          <BreakdownBars items={data.breakdown} />
        </>
      }
      row3={
        <>
          <StatusDonut segments={data.donut} />
          <StatusPills items={overviewData?.platformHealth ?? data.pills} />
          <ActivityFeed items={data.feed} />
        </>
      }
    />
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
      endpoint="/api/dashboard/overview"
      chartType="line"
      chartColor={DASHBOARD_COLORS.green}
      valuePrefix="$"
      overview
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

  return <ModuleDashboardView endpoint="/api/crm/stats" chartType="line" chartColor={DASHBOARD_COLORS.blue} />;
}

export function OutreachDashboard() {
  return <ModuleDashboardView endpoint="/api/outreach/stats" chartType="line" chartColor={DASHBOARD_COLORS.amber} />;
}

export function InvoicingDashboard() {
  return (
    <ModuleDashboardView
      endpoint="/api/invoices/stats"
      chartType="bar"
      chartColor={DASHBOARD_COLORS.blue}
      dualBar
      valuePrefix="$"
    />
  );
}

export function ContractsDashboard() {
  return <ModuleDashboardView endpoint="/api/contracts/stats" chartType="line" chartColor={DASHBOARD_COLORS.blue} />;
}

export function ProjectsDashboard() {
  return <ModuleDashboardView endpoint="/api/projects/stats" chartType="bar" chartColor={DASHBOARD_COLORS.amber} />;
}

export function SocialDashboard() {
  return <ModuleDashboardView endpoint="/api/social/stats" chartType="line" chartColor={DASHBOARD_COLORS.red} />;
}
