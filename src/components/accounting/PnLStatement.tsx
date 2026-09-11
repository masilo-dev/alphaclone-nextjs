'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Download, 
  RefreshCcw, Calendar, ArrowUpRight, ArrowDownRight,
  PieChart as PieChartIcon, BarChart3, Loader2, AlertCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useTenant } from '@/contexts/TenantContext';

type PnLData = {
  period: { from: string; to: string; label: string };
  revenue: {
    total: number;
    by_month: { month: string; amount: number }[];
    invoices_paid: number;
    invoices_outstanding: number;
    outstanding_total: number;
  };
  expenses: {
    total: number;
    by_category: { category: string; amount: number; percentage: number }[];
  };
  gross_profit: number;
  net_profit: number;
  profit_margin_percent: number;
  currency: string;
  generated_at: string;
};

const COLORS = ['#2dd4bf', '#fbbf24', '#f87171', '#818cf8', '#c084fc', '#fb7185', '#38bdf8', '#a3e635'];

export default function PnLStatement() {
  const { currentTenant } = useTenant();
  const [data, setData] = useState<PnLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const fetchData = async () => {
    if (!currentTenant?.id) {
      setLoading(false);
      setError('Select a workspace to view its financial statement.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let url = `/api/accounting/pnl?period=${period}&tenantId=${encodeURIComponent(currentTenant.id)}`;
      if (dateRange.from) url += `&from_date=${dateRange.from}`;
      if (dateRange.to) url += `&to_date=${dateRange.to}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch P&L data');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, currentTenant?.id]);

  const handleExportPDF = () => {
    window.print();
  };

  const fmt = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: data?.currency || 'USD' }).format(val);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-slate-400 animate-pulse">Generating financial statement...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4 border border-dashed border-slate-700 rounded-3xl">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-white font-semibold">Error loading P&L Statement</p>
        <p className="text-slate-500 text-sm">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Profit & Loss</h2>
          <p className="text-slate-400 text-sm">Real-time financial performance and margin analysis</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
            {(['monthly', 'quarterly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  period === p 
                    ? 'bg-teal-500 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-all group">
            <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            <span className="text-sm font-semibold">Export PDF</span>
          </button>
          <button onClick={fetchData} disabled={loading} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: 'Total Revenue', 
            value: fmt(data?.revenue.total || 0), 
            sub: `${data?.revenue.invoices_paid} Invoices Paid`,
            icon: TrendingUp, 
            color: 'text-teal-400', 
            bg: 'from-teal-500/10 to-transparent' 
          },
          { 
            label: 'Total Expenses', 
            value: fmt(data?.expenses.total || 0), 
            sub: `${data?.expenses.by_category.length} Categories`,
            icon: TrendingDown, 
            color: 'text-red-400', 
            bg: 'from-red-500/10 to-transparent' 
          },
          { 
            label: 'Net Profit', 
            value: fmt(data?.net_profit || 0), 
            sub: data?.net_profit && data.net_profit >= 0 ? 'Profitable Period' : 'Negative Balance',
            icon: DollarSign, 
            color: data?.net_profit && data.net_profit >= 0 ? 'text-teal-400' : 'text-red-400', 
            bg: data?.net_profit && data.net_profit >= 0 ? 'from-teal-500/10 to-transparent' : 'from-red-500/10 to-transparent' 
          },
          { 
            label: 'Profit Margin', 
            value: `${data?.profit_margin_percent || 0}%`, 
            sub: 'Efficiency Ratio',
            icon: data?.profit_margin_percent && data.profit_margin_percent >= 20 ? ArrowUpRight : ArrowDownRight, 
            color: data?.profit_margin_percent && data.profit_margin_percent >= 20 ? 'text-teal-400' : 'text-amber-400', 
            bg: 'from-slate-500/10 to-transparent' 
          },
        ].map((card, i) => (
          <div key={i} className={`bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-slate-700 transition-all`}>
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.bg} -rotate-45 translate-x-12 -translate-y-12 opacity-50 group-hover:opacity-100 transition-opacity`} />
            <card.icon className={`w-5 h-5 ${card.color} mb-3`} />
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{card.label}</p>
            <h3 className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</h3>
            <p className="text-slate-400 text-[10px] mt-2 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-white">Revenue Momentum</h3>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-tighter">
                {fmt(data?.revenue.outstanding_total || 0)} Outstanding
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ChartContainer className="h-full" minHeight={240}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <BarChart data={data?.revenue.by_month || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  itemStyle={{ color: '#2dd4bf' }}
                  cursor={{ fill: '#ffffff08' }}
                />
                <Bar dataKey="amount" fill="url(#revGradient)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf" />
                    <stop offset="100%" stopColor="#2dd4bf20" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
            </ChartContainer>
          </div>
        </div>

        {/* Expenses Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-red-400" />
            <h3 className="font-bold text-white">Expense Distribution</h3>
          </div>
          <div className="h-64 w-full">
            {data?.expenses.by_category.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 italic text-sm">
                No categorized expenses for this period
              </div>
            ) : (
              <ChartContainer className="h-full" minHeight={240}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                <PieChart>
                  <Pie
                    data={data?.expenses.by_category}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="amount"
                  >
                    {data?.expenses.by_category.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
              </ChartContainer>
            )}
          </div>
        </div>
      </div>

      {/* P&L Detailed Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white">Statement of Performance</h3>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Period: {data?.period.label}</span>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {/* Revenue Section */}
            <section>
              <div className="flex justify-between items-end mb-4">
                <h4 className="text-xs font-bold text-teal-400 uppercase tracking-widest">Revenue</h4>
                <span className="text-lg font-bold text-white">{fmt(data?.revenue.total || 0)}</span>
              </div>
              <div className="space-y-2 pl-4 border-l border-slate-800">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Invoiced Revenue (Paid)</span>
                  <span className="text-slate-200">{fmt(data?.revenue.total || 0)}</span>
                </div>
              </div>
              <div className="h-px bg-slate-800 my-4" />
              <div className="flex justify-between font-bold text-sm">
                <span className="text-white">Total Revenue</span>
                <span className="text-white">{fmt(data?.revenue.total || 0)}</span>
              </div>
            </section>

            {/* Expenses Section */}
            <section className="mt-8">
              <div className="flex justify-between items-end mb-4">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest">Operating Expenses</h4>
                <span className="text-lg font-bold text-white">{fmt(data?.expenses.total || 0)}</span>
              </div>
              <div className="space-y-3 pl-4 border-l border-slate-800">
                {data?.expenses.by_category.map((cat, i) => (
                  <div key={i} className="flex justify-between text-sm group">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-400 group-hover:text-slate-200 transition-colors">{cat.category}</span>
                      <span className="text-[10px] text-slate-600">({cat.percentage}%)</span>
                    </div>
                    <span className="text-slate-200">{fmt(cat.amount)}</span>
                  </div>
                ))}
                {data?.expenses.by_category.length === 0 && (
                  <p className="text-slate-600 text-xs italic">No expenses recorded</p>
                )}
              </div>
              <div className="h-px bg-slate-800 my-4" />
              <div className="flex justify-between font-bold text-sm">
                <span className="text-white">Total Expenses</span>
                <span className="text-white">{fmt(data?.expenses.total || 0)}</span>
              </div>
            </section>

            {/* Profit Section */}
            <section className="mt-12 pt-8 border-t-2 border-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <span className="text-sm font-semibold text-slate-400 uppercase tracking-tighter">Gross Profit</span>
                    <span className={`text-xl font-bold ${data?.gross_profit && data.gross_profit >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                      {fmt(data?.gross_profit || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-teal-500/10 p-4 rounded-2xl border border-teal-500/20">
                    <span className="text-sm font-semibold text-teal-500 uppercase tracking-tighter">Net Profit</span>
                    <span className="text-xl font-bold text-teal-400">{fmt(data?.net_profit || 0)}</span>
                  </div>
                </div>
                <div className="flex flex-col justify-center items-center md:items-end space-y-2">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Operating Margin</p>
                    <p className={`text-4xl font-black ${data?.profit_margin_percent && data.profit_margin_percent >= 20 ? 'text-teal-400' : 'text-amber-400'}`}>
                      {data?.profit_margin_percent || 0}%
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 text-right">
                    Calculated on {data ? format(new Date(data.generated_at), 'MMM d, yyyy HH:mm') : '—'}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          nav, aside, button, .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; color: black !important; }
          .bg-slate-900 { background: white !important; border: 1px solid #e2e8f0 !important; }
          .text-white, .text-slate-200 { color: black !important; }
          .text-slate-400, .text-slate-500 { color: #64748b !important; }
        }
      ` }} />
    </div>
  );
}
