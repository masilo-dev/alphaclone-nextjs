'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { generalLedgerService } from '@/services/accounting/generalLedgerService';
import { FileDown, ShieldCheck, Calculator, Percent, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

type TaxRate = { label: string; rate: number };

const PRESET_RATES: TaxRate[] = [
  { label: 'US Federal (21%)', rate: 0.21 },
  { label: 'US + State Est. (26%)', rate: 0.26 },
  { label: 'UK Corp Tax (25%)', rate: 0.25 },
  { label: 'SA Corp Tax (27%)', rate: 0.27 },
  { label: 'EU Average (22%)', rate: 0.22 },
  { label: 'Custom', rate: 0 },
];

export function TaxSummaryPanel() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [grossRevenue, setGrossRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customRate, setCustomRate] = useState('21');
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('year');

  const effectiveRate =
    PRESET_RATES[selectedPreset].rate > 0
      ? PRESET_RATES[selectedPreset].rate
      : parseFloat(customRate) / 100 || 0;

  const taxableIncome = Math.max(0, grossRevenue - totalExpenses);
  const estimatedTax = taxableIncome * effectiveRate;
  const netAfterTax = taxableIncome - estimatedTax;

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

      const { statement } = await generalLedgerService.getProfitLossData(startStr, endStr);
      setGrossRevenue(statement?.totalRevenue ?? 0);
      setTotalExpenses(statement?.totalExpenses ?? 0);
    } catch (err) {
      console.error('[TaxSummaryPanel] load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleExportCSV() {
    const rows = [
      ['Description', 'Amount'],
      ['Gross Revenue', grossRevenue.toFixed(2)],
      ['Total Expenses', totalExpenses.toFixed(2)],
      ['Taxable Income', taxableIncome.toFixed(2)],
      [`Tax Rate (${(effectiveRate * 100).toFixed(1)}%)`, ''],
      ['Estimated Tax Liability', estimatedTax.toFixed(2)],
      ['Net Income After Tax', netAfterTax.toFixed(2)],
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-summary-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Tax summary exported');
  }

  const StatRow = ({ label, value, color = 'text-white', large = false }: {
    label: string; value: string; color?: string; large?: boolean;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className={`${large ? 'text-sm font-black uppercase tracking-wider' : 'text-sm'} text-slate-300`}>{label}</span>
      <span className={`font-black ${large ? 'text-xl' : 'text-base'} font-mono ${color}`}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Calculator className="text-emerald-400" size={20} />
            Tax Summary
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Estimated tax liability based on P&L data</p>
        </div>
        <div className="flex items-center gap-2">
          {(['month', 'quarter', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${period === p ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white border border-white/5'}`}
            >
              {p === 'month' ? 'MTD' : p === 'quarter' ? 'QTD' : 'YTD'}
            </button>
          ))}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
          >
            <FileDown size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tax Rate Selector */}
        <div className="ac-workspace-panel rounded-xl p-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Percent size={14} /> Tax Rate
          </p>
          <div className="space-y-2">
            {PRESET_RATES.map((preset, i) => (
              <button
                key={preset.label}
                onClick={() => setSelectedPreset(i)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${selectedPreset === i ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white border border-white/5'}`}
              >
                {preset.label}
                {preset.rate > 0 && <span className="float-right text-slate-500">{(preset.rate * 100).toFixed(0)}%</span>}
              </button>
            ))}
          </div>
          {selectedPreset === PRESET_RATES.length - 1 && (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min="0"
                max="99"
                value={customRate}
                onChange={e => setCustomRate(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/40"
                placeholder="Rate %"
              />
              <span className="text-slate-400 text-sm font-bold">%</span>
            </div>
          )}
        </div>

        {/* Summary Panel */}
        <div className="lg:col-span-2 ac-workspace-panel rounded-xl p-5 space-y-1">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-4">
            <ShieldCheck size={14} className="text-emerald-400" /> Tax Computation
          </p>
          {loading ? (
            <div className="space-y-3 pt-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <StatRow label="Gross Revenue" value={`$${grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} color="text-emerald-400" />
              <StatRow label="Less: Operating Expenses" value={`-$${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} color="text-rose-400" />
              <StatRow label="Taxable Income" value={`$${taxableIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
              <StatRow
                label={`Estimated Tax (${(effectiveRate * 100).toFixed(1)}%)`}
                value={`-$${estimatedTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                color="text-amber-400"
              />
              <div className="pt-3">
                <StatRow
                  label="Net Income After Tax"
                  value={`$${netAfterTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  color={netAfterTax >= 0 ? 'text-teal-300' : 'text-rose-400'}
                  large
                />
              </div>

              <div className="mt-4 rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
                <p className="text-[10px] text-amber-300 font-bold uppercase tracking-widest">⚠ Estimation Notice</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  This is an estimate based on your posted journal entries. Consult a certified accountant for official tax filing. Deductions and credits are not factored in.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
