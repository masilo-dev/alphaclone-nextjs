'use client';

<<<<<<< HEAD
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, FileText, ChevronRight,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Loader2,
} from 'lucide-react';
import { analyticsService, type AnalyticsData } from '@/services/analyticsService';
import { format, parseISO } from 'date-fns';
import { StandardStatCard, StandardLineChart, type CardTheme } from '@/components/ui/design-system';
import { EnterprisePageHeader } from '@/components/dashboard/responsive/EnterpriseModuleChrome';

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
      <EnterprisePageHeader
        moduleKey="analytics"
        secondaryActions={[{
          label: refreshing ? 'Refreshing…' : 'Refresh',
          onClick: () => loadData(true),
          disabled: refreshing,
        }]}
      >
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`h-[34px] px-4 rounded-lg text-[12px] font-semibold transition-all ${dateRange === r ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'bg-white/5 text-[var(--ws-text-secondary)] border border-white/5'}`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </EnterprisePageHeader>

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
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold capitalize transition-all ${metric === m ? 'text-[#f5f5f5]' : 'text-[#94a3b8] bg-transparent'}`}
              style={{
                backgroundColor: metric === m ? `${METRIC_COLORS[m]}33` : undefined,
                color: metric === m ? METRIC_COLORS[m] : undefined,
              }}
            >
=======
import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, FileText, ChevronRight, Download,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const REVENUE_DATA = [
  { month: 'Jan', revenue: 12400, expenses: 8200, profit: 4200 },
  { month: 'Feb', revenue: 15800, expenses: 9100, profit: 6700 },
  { month: 'Mar', revenue: 11200, expenses: 7800, profit: 3400 },
  { month: 'Apr', revenue: 18900, expenses: 10200, profit: 8700 },
  { month: 'May', revenue: 22100, expenses: 11500, profit: 10600 },
  { month: 'Jun', revenue: 19800, expenses: 12300, profit: 7500 },
];

const REPORTS = [
  { name: 'P&L Statement', icon: BarChart3 },
  { name: 'Balance Sheet', icon: FileText },
  { name: 'Cash Flow Statement', icon: TrendingUp },
  { name: 'Expense Report', icon: TrendingDown },
  { name: 'Revenue Summary', icon: BarChart3 },
  { name: 'Lead Conversion Report', icon: FileText },
  { name: 'Deal Win/Loss Report', icon: PieChart },
  { name: 'Campaign Performance', icon: TrendingUp },
  { name: 'Social Media Analytics', icon: BarChart3 },
];

type DateRange = '7D' | '30D' | '90D';
type ChartMetric = 'revenue' | 'expenses' | 'profit';

const KPI_CHIPS = [
  { label: 'Revenue', value: '$22,100', delta: +18.4, positive: true },
  { label: 'Leads', value: '142', delta: +5.2, positive: true },
  { label: 'Deals Closed', value: '18', delta: -3.1, positive: false },
  { label: 'Invoices Paid', value: '34', delta: +12.0, positive: true },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2">
      <div className="text-[11px] text-slate-400 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="text-[13px] font-bold" style={{ color: p.color }}>
          ${p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
};

const AnalyticsTab: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange>('30D');
  const [metric, setMetric] = useState<ChartMetric>('revenue');

  const metricColors: Record<ChartMetric, string> = {
    revenue: '#2dd4bf',
    expenses: '#f87171',
    profit: '#a78bfa',
  };

  return (
    <div className="overflow-y-auto pb-24 space-y-5 px-4 pt-4">

      {/* Date range pills */}
      <div className="flex gap-2">
        {(['7D', '30D', '90D'] as DateRange[]).map(r => (
          <button key={r} onClick={() => setDateRange(r)} className={`h-[34px] px-4 rounded-full text-[12px] font-bold transition-all ${dateRange === r ? 'bg-teal-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}>{r}</button>
        ))}
      </div>

      {/* KPI chips */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {KPI_CHIPS.map(kpi => (
          <div key={kpi.label} className="flex-shrink-0 min-w-[140px] bg-slate-900 border border-white/5 rounded-2xl p-4">
            <div className="text-[24px] font-bold text-white">{kpi.value}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 mb-2 opacity-55">{kpi.label}</div>
            <div className={`flex items-center gap-1 text-[13px] font-bold ${kpi.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {kpi.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {Math.abs(kpi.delta)}%
            </div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
        {/* Toggle */}
        <div className="flex gap-1.5 mb-4">
          {(['revenue', 'expenses', 'profit'] as ChartMetric[]).map(m => (
            <button key={m} onClick={() => setMetric(m)} className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold capitalize transition-all ${metric === m ? 'text-white' : 'text-slate-500 bg-transparent'}`}
              style={{ backgroundColor: metric === m ? metricColors[m] + '33' : undefined, color: metric === m ? metricColors[m] : undefined }}>
>>>>>>> origin/main
              {m}
            </button>
          ))}
        </div>
<<<<<<< HEAD
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
        <span className="text-[13px] font-bold tracking-wide text-[#c0c0c0] block mb-3">Reports</span>
        <div className="bg-white/5 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
          {REPORTS.map((report) => (
            <button
              key={report.name}
              onClick={() => router.push(report.href)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors"
            >
              <report.icon className="w-5 h-5 text-[#94a3b8] flex-shrink-0" />
              <span className="flex-1 text-[15px] text-[#f5f5f5] text-left">{report.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#adebb3] font-bold">View</span>
                <ChevronRight className="w-4 h-4 text-[#64748b]" />
=======
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={REVENUE_DATA} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={metricColors[metric]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={metricColors[metric]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey={metric} stroke={metricColors[metric]} strokeWidth={2} fill="url(#grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Reports list */}
      <div>
        <span className="text-[13px] font-black uppercase tracking-wider text-slate-400 block mb-3">Reports</span>
        <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
          {REPORTS.map(report => (
            <button key={report.name} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors">
              <report.icon className="w-5 h-5 text-slate-500 flex-shrink-0" />
              <span className="flex-1 text-[15px] text-white text-left">{report.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-teal-400 font-bold">View</span>
                <ChevronRight className="w-4 h-4 text-slate-600" />
>>>>>>> origin/main
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
