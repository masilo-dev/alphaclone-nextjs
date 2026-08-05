'use client';

import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { TrendingDown, BarChart3, PieChart as PieIcon } from 'lucide-react';

type CategoryTotal = { category: string; amount: number; percentage: number; color: string };

const COLORS = ['#14b8a6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#f97316', '#06b6d4', '#84cc16', '#ec4899'];

const CATEGORY_MAP: Record<string, string> = {
  '60': 'Marketing',
  '61': 'Advertising',
  '62': 'Travel',
  '63': 'Office Supplies',
  '64': 'Utilities',
  '65': 'Salaries & Wages',
  '66': 'Professional Fees',
  '67': 'Technology',
  '68': 'Insurance',
  '69': 'Depreciation',
};

function labelFromCode(code: string): string {
  const prefix = code.slice(0, 2);
  return CATEGORY_MAP[prefix] || `Account ${code}`;
}

export function ExpenseCategoryChart() {
  const { currentTenant } = useTenant();
  const [data, setData] = useState<CategoryTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!currentTenant) return;
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant, period]);

  async function load() {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (period === 'quarter') {
        const q = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), q * 3, 1);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
      }
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = now.toISOString().split('T')[0];

      const { data: lines } = await supabase
        .from('journal_entry_lines')
        .select('account_code, account_name, debit_amount, credit_amount, account_type')
        .eq('tenant_id', currentTenant.id)
        .eq('account_type', 'expense')
        .gte('created_at', startStr)
        .lte('created_at', endStr + 'T23:59:59');

      if (!lines?.length) {
        setData([]);
        setTotal(0);
        return;
      }

      const grouped: Record<string, number> = {};
      for (const line of lines) {
        const label = line.account_name || labelFromCode(String(line.account_code || ''));
        const amount = Number(line.debit_amount || 0) - Number(line.credit_amount || 0);
        grouped[label] = (grouped[label] || 0) + Math.abs(amount);
      }

      const grandTotal = Object.values(grouped).reduce((a, b) => a + b, 0);
      setTotal(grandTotal);

      const sorted = Object.entries(grouped)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([category, amount], i) => ({
          category,
          amount,
          percentage: grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0,
          color: COLORS[i % COLORS.length],
        }));
      setData(sorted);
    } catch (err) {
      console.error('[ExpenseCategoryChart] load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload as CategoryTotal;
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs shadow-xl">
        <p className="font-bold text-white">{item.category}</p>
        <p className="text-emerald-400">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        <p className="text-slate-400">{item.percentage}% of total</p>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <TrendingDown className="text-rose-400" size={20} />
            Expense Breakdown
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Total: <span className="text-rose-300 font-bold">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['month', 'quarter', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${period === p ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-white border border-white/5'}`}
            >
              {p === 'month' ? 'MTD' : p === 'quarter' ? 'QTD' : 'YTD'}
            </button>
          ))}
          <div className="flex items-center gap-1 border border-white/5 rounded-lg overflow-hidden">
            <button onClick={() => setChartType('pie')} className={`p-2 ${chartType === 'pie' ? 'bg-white/10 text-white' : 'text-slate-400'}`}>
              <PieIcon size={14} />
            </button>
            <button onClick={() => setChartType('bar')} className={`p-2 ${chartType === 'bar' ? 'bg-white/10 text-white' : 'text-slate-400'}`}>
              <BarChart3 size={14} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="ac-workspace-panel rounded-xl p-8 flex items-center justify-center min-h-[320px]">
          <div className="text-slate-500 text-sm animate-pulse">Loading expense data...</div>
        </div>
      ) : data.length === 0 ? (
        <div className="ac-workspace-panel rounded-xl p-8 flex flex-col items-center justify-center min-h-[280px] text-center">
          <TrendingDown className="text-slate-600 mb-3" size={40} />
          <p className="text-slate-400 font-semibold">No expense data for this period</p>
          <p className="text-slate-500 text-sm mt-1">Record journal entries or upload receipts to see your spending breakdown.</p>
        </div>
      ) : (
        <div className="ac-workspace-panel rounded-xl p-4 sm:p-6">
          {chartType === 'pie' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className="min-h-[280px]">
                <ResponsiveContainer width="100%" height={280} minWidth={0}>
                  <PieChart>
                    <Pie data={data} cx="50%" cy="50%" outerRadius={110} innerRadius={55} dataKey="amount" paddingAngle={2}>
                      {data.map((entry, i) => (
                        <Cell key={entry.category} fill={entry.color} opacity={0.9} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {data.map(item => (
                  <div key={item.category} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-slate-300 truncate">{item.category}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-white">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                      <span className="text-xs text-slate-500 ml-2">{item.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="min-h-[300px]">
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {data.map((entry, i) => (
                      <Cell key={entry.category} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
