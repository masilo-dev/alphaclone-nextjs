'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { TrendingUp, DollarSign, Target, BarChart3 } from 'lucide-react';
import { WrapChart } from '@/lib/chartWrapper';

type StageData = {
  stage: string;
  label: string;
  deals: number;
  totalValue: number;
  weightedValue: number;
  probability: number;
  color: string;
};

const STAGE_CONFIG: Record<string, { label: string; color: string; defaultProb: number }> = {
  lead:        { label: 'Lead',        color: '#6366f1', defaultProb: 10 },
  qualified:   { label: 'Qualified',   color: '#8b5cf6', defaultProb: 25 },
  proposal:    { label: 'Proposal',    color: '#a855f7', defaultProb: 50 },
  negotiation: { label: 'Negotiation', color: '#f59e0b', defaultProb: 75 },
  closed_won:  { label: 'Closed Won',  color: '#10b981', defaultProb: 100 },
};

export function PipelineForecastPanel() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState<StageData[]>([]);
  const [totalPipeline, setTotalPipeline] = useState(0);
  const [weightedForecast, setWeightedForecast] = useState(0);

  useEffect(() => {
    if (!currentTenant) return;
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant]);

  async function load() {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data: deals, error } = await supabase
        .from('deals')
        .select('id, value, stage, probability')
        .eq('tenant_id', currentTenant.id)
        .not('stage', 'in', '("closed_lost")');

      if (error) throw error;

      const grouped: Record<string, { totalValue: number; weightedValue: number; deals: number }> = {};
      for (const deal of (deals || [])) {
        const stage = deal.stage as string;
        if (!grouped[stage]) grouped[stage] = { totalValue: 0, weightedValue: 0, deals: 0 };
        const prob = (deal.probability || STAGE_CONFIG[stage]?.defaultProb || 10) / 100;
        grouped[stage].totalValue += Number(deal.value || 0);
        grouped[stage].weightedValue += Number(deal.value || 0) * prob;
        grouped[stage].deals++;
      }

      const stageData: StageData[] = Object.entries(STAGE_CONFIG).map(([key, cfg]) => ({
        stage: key,
        label: cfg.label,
        color: cfg.color,
        probability: cfg.defaultProb,
        deals: grouped[key]?.deals || 0,
        totalValue: grouped[key]?.totalValue || 0,
        weightedValue: grouped[key]?.weightedValue || 0,
      })).filter(s => s.deals > 0 || s.stage === 'lead');

      const total = stageData.reduce((a, s) => a + s.totalValue, 0);
      const weighted = stageData.reduce((a, s) => a + s.weightedValue, 0);
      setTotalPipeline(total);
      setWeightedForecast(weighted);
      setStages(stageData);
    } catch (err) {
      console.error('[PipelineForecastPanel]', err);
    } finally {
      setLoading(false);
    }
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as StageData;
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs shadow-xl space-y-1">
        <p className="font-black text-white">{d.label}</p>
        <p className="text-slate-300">{d.deals} deal{d.deals !== 1 ? 's' : ''}</p>
        <p className="text-slate-400">Total value: <span className="text-white font-bold">${d.totalValue.toLocaleString()}</span></p>
        <p className="text-slate-400">Weighted: <span className="text-teal-300 font-bold">${Math.round(d.weightedValue).toLocaleString()}</span></p>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
          <BarChart3 className="text-teal-400" size={20} /> Pipeline Revenue Forecast
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">Weighted by deal probability across all active stages</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="ac-workspace-panel rounded-xl p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <DollarSign size={13} className="text-slate-500" /> Total Pipeline
          </p>
          <p className="text-2xl font-black text-white mt-2">${totalPipeline.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-1">Gross value, all active deals</p>
        </div>
        <div className="ac-workspace-panel rounded-xl p-4 border border-teal-500/20">
          <p className="text-xs font-black uppercase tracking-widest text-teal-400 flex items-center gap-1.5">
            <Target size={13} /> Weighted Forecast
          </p>
          <p className="text-2xl font-black text-teal-300 mt-2">${Math.round(weightedForecast).toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-1">Expected revenue by probability</p>
        </div>
      </div>

      {loading ? (
        <div className="ac-workspace-panel rounded-xl p-8 flex items-center justify-center min-h-[280px]">
          <p className="text-slate-500 text-sm animate-pulse">Loading pipeline data...</p>
        </div>
      ) : (
        <>
          <div className="ac-workspace-panel rounded-xl p-4 sm:p-6">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Weighted Value by Stage</p>
            <div className="min-h-[240px]">
              <WrapChart height={240}>
                <BarChart data={stages} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="weightedValue" radius={[6, 6, 0, 0]}>
                    {stages.map(s => <Cell key={s.stage} fill={s.color} />)}
                  </Bar>
                </BarChart>
              </WrapChart>
            </div>
          </div>

          <div className="ac-workspace-panel rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 bg-[var(--ws-toolbar)]">
              <p className="text-xs font-black uppercase tracking-widest text-white">Stage Breakdown</p>
            </div>
            <div className="divide-y divide-white/5">
              {stages.map(s => (
                <div key={s.stage} className="px-5 py-3 flex items-center gap-4">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-sm text-slate-300 flex-1">{s.label}</span>
                  <span className="text-xs text-slate-500">{s.deals} deals</span>
                  <span className="text-sm font-bold text-white w-28 text-right">${s.totalValue.toLocaleString()}</span>
                  <span className="text-sm font-black text-teal-300 w-28 text-right">${Math.round(s.weightedValue).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
