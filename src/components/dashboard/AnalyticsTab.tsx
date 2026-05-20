'use client';

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
              {m}
            </button>
          ))}
        </div>
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
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
