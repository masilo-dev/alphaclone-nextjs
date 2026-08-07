'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Loader2, Download, Users, TrendingUp, BarChart3 } from 'lucide-react';
import { dealService } from '@/services/dealService';
import { leadService } from '@/services/leadService';
import { StandardStatCard } from '@/components/ui/design-system';
import { isLeadConverted, leadConversionRate } from '@/domain/metrics';
import { WrapChart } from '@/lib/chartWrapper';

const COLORS = ['#14b8a6', '#06b6d4', '#8b5cf6', '#f87171', '#64748b'];

export default function CRMReportsTab() {
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<{ stage: string; count: number; totalValue: number }[]>([]);
  const [leadStats, setLeadStats] = useState<{
    total: number;
    qualified: number;
    conversion: number | null;
    conversionUnavailable?: string;
  }>({ total: 0, qualified: 0, conversion: null });

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
      const qualified = leads.filter((l) => String(l.status).toLowerCase() === 'qualified').length;
      const converted = leads.filter((l) =>
        isLeadConverted(l.status, (l as { client_id?: string }).client_id)
      ).length;
      const { rate, unavailableReason } = leadConversionRate({
        total: leads.length,
        converted,
      });
      setLeadStats({
        total: leads.length,
        qualified,
        conversion: rate,
        conversionUnavailable: unavailableReason,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" aria-hidden="true" />
        <span className="sr-only">Loading CRM reports</span>
      </div>
    );
  }

  const winLoss = pipeline.filter((p) => p.stage.includes('closed'));
  const conversionDisplay =
    leadStats.conversion == null ? 'Not tracked' : `${leadStats.conversion}%`;

  return (
    <div className="p-4 space-y-6 overflow-y-auto pb-24">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Leads', value: leadStats.total, icon: Users, theme: 'teal' as const },
          { label: 'Qualified', value: leadStats.qualified, icon: TrendingUp, theme: 'emerald' as const },
          {
            label: 'Conversion %',
            value: conversionDisplay,
            icon: BarChart3,
            theme: 'blue' as const,
            comparisonText:
              leadStats.conversionUnavailable ||
              'Converted status ÷ total leads (excludes qualified-only)',
          },
        ].map((s) => (
          <StandardStatCard
            key={s.label}
            label={s.label}
            value={s.value}
            themeColor={s.theme}
            icon={s.icon}
            interactive={false}
            comparisonText={'comparisonText' in s ? s.comparisonText : undefined}
          />
        ))}
      </div>

      <div className="bg-slate-900 border border-white/5 rounded-lg p-4">
        <h3 className="text-sm font-bold text-white mb-4">Pipeline by Stage</h3>
        <WrapChart height={220}>
          <BarChart data={pipeline}>
            <XAxis dataKey="stage" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
            <Bar dataKey="totalValue" fill="#14b8a6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </WrapChart>
      </div>

      {winLoss.length > 0 && (
        <div className="bg-slate-900 border border-white/5 rounded-lg p-4">
          <h3 className="text-sm font-bold text-white mb-4">Win / Loss (closed deals)</h3>
          <WrapChart height={180}>
            <PieChart>
              <Pie data={winLoss} dataKey="count" nameKey="stage" cx="50%" cy="50%" outerRadius={70}>
                {winLoss.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </WrapChart>
        </div>
      )}

      <button
        type="button"
        onClick={() => window.open('/dashboard/business/reports', '_self')}
        className="w-full flex items-center justify-center gap-2 min-h-11 rounded-lg border border-teal-500/30 text-teal-400 text-sm font-bold hover:bg-teal-500/10"
      >
        <Download className="w-4 h-4" aria-hidden="true" /> Export full revenue report
      </button>
    </div>
  );
}
