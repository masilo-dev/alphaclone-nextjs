'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, FileText, ChevronRight,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Loader2, RefreshCw,
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsService, type AnalyticsData } from '@/services/analyticsService';
import { format, parseISO } from 'date-fns';

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

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2">
      <div className="text-[11px] text-slate-400 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="text-[13px] font-bold" style={{ color: p.color }}>
          {p.dataKey === 'revenue' ? `$${p.value.toLocaleString()}` : p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
};

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
      delta: trend,
      positive: trend >= 0,
      href: '/dashboard/business/reports',
      display: `${Math.abs(trend).toFixed(1)}%`,
    },
    {
      label: 'Active Projects',
      value: String(stats.projects.active),
      delta: stats.projects.completed,
      positive: true,
      href: '/dashboard/business/projects',
      display: `${stats.projects.completed} completed`,
    },
    {
      label: 'Clients',
      value: String(stats.users.clients),
      delta: stats.users.growth,
      positive: stats.users.growth >= 0,
      href: '/dashboard/contacts',
      display: `${Math.abs(stats.users.growth).toFixed(1)}%`,
    },
    {
      label: 'On-Time Delivery',
      value: `${stats.performance.onTimeDelivery}%`,
      delta: stats.performance.clientSatisfaction,
      positive: stats.performance.onTimeDelivery >= 80,
      href: '/dashboard/performance',
      display: `${stats.performance.clientSatisfaction}/5 satisfaction`,
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
    <div className="overflow-y-auto pb-24 space-y-5 px-4 pt-4">
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
          <button
            key={kpi.label}
            onClick={() => router.push(kpi.href)}
            className="flex-shrink-0 min-w-[140px] bg-slate-900 border border-white/5 rounded-2xl p-4 text-left hover:border-teal-500/30 transition-colors"
          >
            <div className="text-[24px] font-bold text-white">{kpi.value}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 mb-2">{kpi.label}</div>
            <div className={`flex items-center gap-1 text-[13px] font-bold ${kpi.positive ? 'text-teal-400' : 'text-red-400'}`}>
              {kpi.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {kpi.display}
            </div>
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
        <div className="flex gap-1.5 mb-4">
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
        {chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
            No data for this period yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={METRIC_COLORS[metric]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={METRIC_COLORS[metric]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey={metric} stroke={METRIC_COLORS[metric]} strokeWidth={2} fill="url(#analyticsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
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
