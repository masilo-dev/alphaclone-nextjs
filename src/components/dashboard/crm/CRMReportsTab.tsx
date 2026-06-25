'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader2, Download } from 'lucide-react';
import { dealService } from '@/services/dealService';
import { leadService } from '@/services/leadService';

const COLORS = ['#14b8a6', '#06b6d4', '#8b5cf6', '#f87171', '#64748b'];

export default function CRMReportsTab() {
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<{ stage: string; count: number; totalValue: number }[]>([]);
  const [leadStats, setLeadStats] = useState({ total: 0, qualified: 0, conversion: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ stats }, { leads }] = await Promise.all([
        dealService.getPipelineStats(),
        leadService.getLeads(),
      ]);
      setPipeline(
        (stats || []).map((s) => ({
          stage: s.stage.replace(/_/g, ' '),
          count: s.dealCount,
          totalValue: s.totalValue,
        }))
      );
      const qualified = leads.filter((l) => l.status === 'qualified').length;
      const won = leads.filter((l) => l.status === 'qualified' || l.client_id).length;
      setLeadStats({
        total: leads.length,
        qualified,
        conversion: leads.length ? Math.round((won / leads.length) * 100) : 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    );
  }

  const winLoss = pipeline.filter((p) => p.stage.includes('closed'));

  return (
    <div className="p-4 space-y-6 overflow-y-auto pb-24">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Leads', value: leadStats.total },
          { label: 'Qualified', value: leadStats.qualified },
          { label: 'Conversion %', value: `${leadStats.conversion}%` },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900 border border-white/5 rounded-2xl p-4">
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className="text-2xl font-bold text-teal-400">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white mb-4">Pipeline by Stage</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={pipeline}>
            <XAxis dataKey="stage" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
            <Bar dataKey="totalValue" fill="#14b8a6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {winLoss.length > 0 && (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white mb-4">Win / Loss</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={winLoss} dataKey="count" nameKey="stage" cx="50%" cy="50%" outerRadius={70}>
                {winLoss.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <button
        onClick={() => window.open('/dashboard/business/reports', '_self')}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-teal-500/30 text-teal-400 text-sm font-bold hover:bg-teal-500/10"
      >
        <Download className="w-4 h-4" /> Export full revenue report
      </button>
    </div>
  );
}
