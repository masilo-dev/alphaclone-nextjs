'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, FileText, ChevronRight,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Loader2, RefreshCw,
} from 'lucide-react';
import { analyticsService, type AnalyticsData } from '@/services/analyticsService';
import { format, parseISO } from 'date-fns';
import { StandardStatCard, StandardLineChart, type CardTheme } from '@/components/ui/design-system';

type DateRange = '7d' | '30d' | '90d';
type ChartMetric = 'revenue' | 'projects';

const REPORTS = [
  { name: 'P&L Statement', icon: BarChart3, href: '/dashboard/accounting' },
  { name: 'Balance Sheet', icon: FileText, href: '/dashboard/accounting' },
  { name: 'Cash Flow Forecast', icon: TrendingUp, href: '/dashboard/business/cash-flow' },
  { name: 'Expense Report', icon: TrendingDown, href: '/dashboard/business/expenses' },
  { name: 'Revenue Summary', icon: BarChart3, href: '/dashboard/business/reports' },
  { name: 'Lead Pipeline', icon: FileText, href: '/dashboard/leads' },
  { name: 'Deal Win/Loss', icon: PieChart, href: '/dashboard/deals' },
  { name: 'Campaign Performance', icon: TrendingUp, href: '/dashboard/business/campaigns' },
  { name: 'Social Media Analytics', icon: BarChart3, href: '/dashboard/business/social' },
];

const METRIC_COLORS = {
  revenue: '#14b8a6',
  projects: '#8b5cf6',
} as const;

function formatChartLabel(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d');
  } catch {
    return dateStr;
  }
}

function buildKpiChips(stats: AnalyticsData) {
  const trend = stats.revenue.trend;
  return [
    {
      label: 'Revenue',
      value: `$${stats.revenue.total.toLocaleString()}`,
      delta: trend >= 0 ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%`,
      deltaDir: (trend >= 0 ? 'up' : 'down') as 'up' | 'down',
      theme: 'teal' as CardTheme,
      href: '/dashboard/business/reports',
    },
    {
      label: 'Active Projects',
      value: String(stats.projects.active),
      delta: `${stats.projects.completed} completed`,
      deltaDir: 'none' as const,
      theme: 'purple' as CardTheme,
      href: '/dashboard/business/projects',
    },
    {
      label: 'Clients',
      value: String(stats.users.clients),
      delta: stats.users.growth >= 0 ? `+${stats.users.growth.toFixed(1)}%` : `${stats.users.growth.toFixed(1)}%`,
      deltaDir: (stats.users.growth >= 0 ? 'up' : 'down') as 'up' | 'down',
      theme: 'blue' as CardTheme,
      href: '/dashboard/contacts',
    },
    {
      label: 'On-Time Delivery',
      value: `${stats.performance.onTimeDelivery}%`,
      delta: `${stats.performance.clientSatisfaction}/5 sat`,
      deltaDir: 'none' as const,
      theme: 'amber' as CardTheme,
      href: '/dashboard/performance',
    },
  ];
}

const AnalyticsTab: React.FC = () => {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [metric, setMetric] = useState<ChartMetric>('revenue');
  const [stats, setStats] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const { data, error } = await analyticsService.getAnalytics(dateRange);
    if (data) setStats(data);
    else console.error('Failed to load analytics:', error);
    setLoading(false);
    setRefreshing(false);
  }, [dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chartData = stats?.revenue.byPeriod.map((p) => {
    const proj = stats.projects.byPeriod.find((pp) => pp.date === p.date);
    return {
      month: formatChartLabel(p.date),
      revenue: p.revenue,
      projects: proj?.count ?? 0,
      label: formatChartLabel(p.date),
      value: metric === 'revenue' ? p.revenue : (proj?.count ?? 0)
    };
  }) ?? [];

  const kpiChips = stats ? buildKpiChips(stats) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="ac-scroll-full ac-enterprise-module pb-24 space-y-5 px-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`h-[34px] px-4 rounded-full text-[12px] font-bold transition-all ${dateRange === r ? 'bg-teal-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="p-2 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-teal-400 transition-colors"
          aria-label="Refresh analytics"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {kpiChips.map((kpi) => (
          <StandardStatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            delta={kpi.delta}
            deltaDir={kpi.deltaDir}
            themeColor={kpi.theme}
            onClick={() => router.push(kpi.href)}
            className="flex-shrink-0 min-w-[170px]"
            comparisonText=""
          />
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex gap-1.5">
          {(['revenue', 'projects'] as ChartMetric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold capitalize transition-all ${metric === m ? 'text-white' : 'text-slate-500 bg-transparent'}`}
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
          color={metric === 'revenue' ? '#14b8a6' : '#8b5cf6'}
          valuePrefix={metric === 'revenue' ? '$' : ''}
          height={200}
        />
      </div>

      <div>
        <span className="text-[13px] font-bold tracking-wide text-slate-400 block mb-3">Reports</span>
        <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
          {REPORTS.map((report) => (
            <button
              key={report.name}
              onClick={() => router.push(report.href)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors"
            >
              <report.icon className="w-5 h-5 text-slate-500 flex-shrink-0" />
              <span className="flex-1 text-[15px] text-white text-left">{report.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-teal-400 font-bold">View</span>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
