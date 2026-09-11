'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingDown, FileText, ChevronRight,
  BarChart3, PieChart, Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { StandardLineChart } from '@/components/ui/design-system';
import { EnterprisePageHeader } from '@/components/dashboard/responsive/EnterpriseModuleChrome';
import { PlatformKpiGrid, MetricDateRangeSelector, ModuleKpiRichSections } from '@/components/dashboard/metrics';
import { platformKpiFromNumbers } from '@/lib/metrics/metricPresentation';
import { useMetricDateRange } from '@/hooks/useMetricDateRange';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useTenant } from '@/contexts/TenantContext';

const REPORTS = [
  { name: 'P&L Statement', icon: BarChart3, href: '/dashboard/accounting' },
  { name: 'Balance Sheet', icon: FileText, href: '/dashboard/accounting' },
  { name: 'Cash Flow Forecast', icon: TrendingDown, href: '/dashboard/business/cash-flow' },
  { name: 'Expense Report', icon: TrendingDown, href: '/dashboard/business/expenses' },
  { name: 'Revenue Summary', icon: BarChart3, href: '/dashboard/business/reports' },
  { name: 'Lead Pipeline', icon: FileText, href: '/dashboard/leads' },
  { name: 'Deal Win/Loss', icon: PieChart, href: '/dashboard/deals' },
  { name: 'Campaign Performance', icon: BarChart3, href: '/dashboard/business/campaigns' },
  { name: 'Social Media Analytics', icon: BarChart3, href: '/dashboard/business/social' },
];

const METRIC_COLORS = {
  revenue: '#14b8a6',
  projects: '#8b5cf6',
} as const;

type ChartMetric = 'revenue' | 'projects';

function formatChartLabel(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d');
  } catch {
    return dateStr;
  }
}

const AnalyticsTab: React.FC = () => {
  const router = useRouter();
  const { currentTenant } = useTenant();
  const { preset, setPeriod, comparisonLabel } = useMetricDateRange('last_30_days');
  const [metric, setMetric] = useState<ChartMetric>('revenue');
  const { data: overviewStats, loading, isValidating } = useDashboardStats(
    currentTenant?.id,
    '/api/dashboard/overview',
    preset,
  );

  const kpiItems = useMemo(() => {
    if (!overviewStats) return [];
    const revenueMetric = overviewStats.metrics.find((m) =>
      String(m.label).toLowerCase().includes('invoiced'),
    );
    const dealsMetric = overviewStats.metrics.find((m) =>
      String(m.label).toLowerCase().includes('deals'),
    );
    const tasksMetric = overviewStats.metrics.find((m) =>
      String(m.label).toLowerCase().includes('tasks'),
    );
    const emailsMetric = overviewStats.metricsRowB?.find((m) =>
      String(m.label).toLowerCase().includes('email'),
    );
    return [
      platformKpiFromNumbers({
        metricId: 'home.total_revenue',
        label: 'Revenue',
        current: Number(String(revenueMetric?.value ?? 0).replace(/[^0-9.-]/g, '')) || 0,
        formattedValue: String(revenueMetric?.value ?? '$0'),
        referencePeriod: comparisonLabel,
        href: '/dashboard/business/billing',
      }),
      platformKpiFromNumbers({
        label: 'Active deals',
        current: Number(dealsMetric?.value ?? 0),
        referencePeriod: comparisonLabel,
        href: '/dashboard/deals',
      }),
      platformKpiFromNumbers({
        label: 'Open tasks',
        current: Number(tasksMetric?.value ?? 0),
        referencePeriod: comparisonLabel,
        href: '/dashboard/tasks',
      }),
      platformKpiFromNumbers({
        label: 'Emails sent',
        current: Number(emailsMetric?.value ?? 0),
        referencePeriod: comparisonLabel,
        href: '/dashboard/business/campaigns',
      }),
    ];
  }, [overviewStats, comparisonLabel]);

  const chartData =
    overviewStats?.mainChart.map((p) => ({
      month: p.label,
      revenue: p.value,
      projects: 0,
      label: p.label,
      value: metric === 'revenue' ? p.value : 0,
    })) ?? [];

  if (loading && !overviewStats) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="ac-scroll-full ac-enterprise-module pb-24 space-y-5 px-4 pt-4">
      <EnterprisePageHeader moduleKey="analytics">
        <MetricDateRangeSelector value={preset} onChange={setPeriod} compact />
      </EnterprisePageHeader>

      <PlatformKpiGrid items={kpiItems} loading={loading} skeletonCount={4} />

      {overviewStats ? (
        <ModuleKpiRichSections
          data={overviewStats}
          comparisonLabel={comparisonLabel}
          showPlatformHealth
        />
      ) : null}

      <div className="space-y-4">
        <div className="flex gap-1.5">
          {(['revenue', 'projects'] as ChartMetric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold capitalize transition-all ${metric === m ? 'text-[#f5f5f5]' : 'text-[#94a3b8] bg-transparent'}`}
              style={{
                backgroundColor: metric === m ? `${METRIC_COLORS[m]}33` : undefined,
                color: metric === m ? METRIC_COLORS[m] : undefined,
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <StandardLineChart
          data={chartData}
          xKey="label"
          yKey="value"
          name={metric}
          color={METRIC_COLORS[metric]}
          height={280}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORTS.map(({ name, icon: Icon, href }) => (
          <button
            key={name}
            type="button"
            onClick={() => router.push(href)}
            className="ac-workspace-panel p-4 text-left hover:border-teal-500/30 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Icon className="w-5 h-5 text-teal-400" />
              <span className="text-sm font-semibold text-white group-hover:text-teal-300">{name}</span>
              <ChevronRight className="w-4 h-4 ml-auto text-slate-500 group-hover:text-teal-400" />
            </div>
          </button>
        ))}
      </div>

      {isValidating ? (
        <p className="text-[11px] text-slate-500 text-right">Refreshing metrics…</p>
      ) : null}
    </div>
  );
};

export default AnalyticsTab;
