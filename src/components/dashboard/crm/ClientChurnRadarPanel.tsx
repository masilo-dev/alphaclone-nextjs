'use client';

import React, { useState } from 'react';
import { churnRadarService, ClientHealthRecord } from '@/services/churnRadarService';
import { ShieldAlert, AlertTriangle, CheckCircle, Activity, ArrowUpRight, RefreshCw, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export function ClientChurnRadarPanel() {
  const [records, setRecords] = useState<ClientHealthRecord[]>(() => churnRadarService.getMockClientHealthRecords());
  const [filter, setFilter] = useState<'all' | 'high_risk' | 'moderate' | 'healthy'>('all');

  const filteredRecords = records.filter(r => {
    if (filter === 'high_risk') return r.riskLevel === 'High Churn Risk';
    if (filter === 'moderate') return r.riskLevel === 'Moderate Risk';
    if (filter === 'healthy') return r.riskLevel === 'Healthy';
    return true;
  });

  const highRiskCount = records.filter(r => r.riskLevel === 'High Churn Risk').length;
  const avgHealth = Math.round(records.reduce((sum, r) => sum + r.healthScore, 0) / records.length);

  const handleActionClick = (record: ClientHealthRecord) => {
    toast.success(`Action initiated for ${record.company}: "${record.recommendedAction}"`);
  };

  return (
    <div className="ac-workspace-panel rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Activity size={16} />
          </div>
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider">Client Churn Risk & Health Radar</h4>
            <p className="text-[11px] text-slate-400">Predictive retention analytics & proactive recovery plays</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold">
            Average Health: <span className="text-teal-400 font-black">{avgHealth}%</span>
          </span>
          <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
            {highRiskCount} High Risk
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-white/10 pb-3">
        {[
          { id: 'all', label: 'All Accounts' },
          { id: 'high_risk', label: 'High Churn Risk' },
          { id: 'moderate', label: 'Moderate Risk' },
          { id: 'healthy', label: 'Healthy' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === t.id
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Grid of Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRecords.map((r) => {
          const isHigh = r.riskLevel === 'High Churn Risk';
          const isMod = r.riskLevel === 'Moderate Risk';

          return (
            <div
              key={r.id}
              className={`p-4 rounded-xl border transition-all ${
                isHigh
                  ? 'bg-rose-500/5 border-rose-500/30'
                  : isMod
                  ? 'bg-amber-500/5 border-amber-500/30'
                  : 'bg-teal-500/5 border-teal-500/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h5 className="text-xs font-bold text-white">{r.company}</h5>
                  <p className="text-[11px] text-slate-400">{r.name}</p>
                </div>
                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                    isHigh
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : isMod
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {r.riskLevel}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">Health Score</span>
                  <span className={isHigh ? 'text-rose-400' : isMod ? 'text-amber-400' : 'text-emerald-400'}>
                    {r.healthScore} / 100
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-white/10">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isHigh ? 'bg-rose-500' : isMod ? 'bg-amber-500' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${r.healthScore}%` }}
                  />
                </div>
              </div>

              {/* Signals */}
              <div className="grid grid-cols-3 gap-2 mt-3 text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-white/5">
                <div>
                  <span className="block font-bold text-white">{r.lastActiveDaysAgo}d ago</span>
                  <span>Last Active</span>
                </div>
                <div>
                  <span className="block font-bold text-white">{Math.round(r.unpaidInvoiceRatio * 100)}%</span>
                  <span>Unpaid Ratio</span>
                </div>
                <div>
                  <span className="block font-bold text-white">{r.contractExpiringDays}d</span>
                  <span>Contract Exp</span>
                </div>
              </div>

              {/* Playbook Recommendation */}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-300 italic truncate max-w-[240px]">
                  "{r.recommendedAction}"
                </p>
                <button
                  onClick={() => handleActionClick(r)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors shrink-0"
                >
                  Playbook <ArrowUpRight size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
