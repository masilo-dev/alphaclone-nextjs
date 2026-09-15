'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Loader2, Download, Users, TrendingUp, BarChart3, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { dealService } from '@/services/dealService';
import { leadService } from '@/services/leadService';
import {
  IntelligentKpiCard,
  FunnelVisualization,
  BottleneckDetector,
  BonnieBrief,
} from '@/components/ui/intelligence';
import { isLeadConverted, leadConversionRate } from '@/domain/metrics';
import { WrapChart } from '@/lib/chartWrapper';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

const COLORS = ['#14b8a6', '#06b6d4', '#8b5cf6', '#f87171', '#64748b'];

export default function CRMReportsTab() {
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<{ stage: string; count: number; totalValue: number }[]>([]);
  const [leadStats, setLeadStats] = useState<{
    total: number;
    qualified: number;
    conversion: number | null;
    conversionUnavailable?: string;
    stale: number;
    contacted: number;
  }>({ total: 0, qualified: 0, conversion: null, stale: 0, contacted: 0 });

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
      const stale = leads.filter((l: any) => {
        const age = l.created_at ? (Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24) : 0;
        return age > 30 && !isLeadConverted(l.status, l.client_id);
      }).length;
      const contacted = leads.filter((lead) => {
        const stage = String(lead.stage || lead.status || '').trim().toLowerCase();
        return Boolean(
          lead.client_id ||
          lead.outreachStatus ||
          ['contacted', 'replied', 'qualified', 'proposal', 'negotiation', 'won', 'converted'].includes(stage)
        );
      }).length;
      setLeadStats({
        total: leads.length,
        qualified,
        conversion: rate,
        conversionUnavailable: unavailableReason,
        stale,
        contacted,
      });
      setLoading(false);
    })();
  }, []);

  const conversionDisplay =
    leadStats.conversion == null ? 'Not tracked' : `${leadStats.conversion}%`;

  const leadFunnel = useMemo(() => {
    const stages: { key: string; label: string; count: number }[] = [];
    stages.push({ key: 'captured', label: 'Leads captured', count: leadStats.total });
    stages.push({ key: 'contacted', label: 'Contacted', count: leadStats.contacted });
    stages.push({ key: 'qualified', label: 'Qualified', count: leadStats.qualified });
    stages.push({ key: 'opportunity', label: 'Opportunity', count: pipeline.reduce((s, p) => s + p.count, 0) });
    const won = pipeline.find((p) => p.stage.toLowerCase().includes('won'));
    stages.push({ key: 'won', label: 'Won / customer', count: won?.count ?? 0 });
    return stages;
  }, [leadStats, pipeline]);

  const crmBonnie = useMemo(() => {
    const whatChanged: string[] = [];
    const whyItMatters: string[] = [];
    const whatToDo: string[] = [];

    whatChanged.push(`CRM holds ${leadStats.total} lead${leadStats.total !== 1 ? 's' : ''} · ${leadStats.qualified} qualified · ${leadStats.stale} stale beyond 30 days.`);
    if (leadStats.conversion != null) {
      whatChanged.push(`Lead-to-customer conversion sits at ${leadStats.conversion}%.`);
    } else if (leadStats.conversionUnavailable) {
      whatChanged.push(`Conversion tracking: ${leadStats.conversionUnavailable}.`);
    }

    if (leadStats.stale > 0 && leadStats.total > 0) {
      const stalePct = Math.round((leadStats.stale / leadStats.total) * 100);
      whyItMatters.push(`${stalePct}% of leads are older than 30 days and have not converted; they need an explicit next action or lifecycle exit.`);
    }
    if (leadStats.conversion != null && leadStats.conversion < 3) {
      whyItMatters.push('Conversion is under 3%; review source quality, qualification, and follow-up history before changing acquisition spend.');
    }
    if (whyItMatters.length === 0) {
      whyItMatters.push('CRM indicators are balanced — protect lead velocity above raw count.');
    }

    if (leadStats.stale > 0) whatToDo.push(`Review the ${leadStats.stale} stale lead${leadStats.stale === 1 ? '' : 's'} and record a next action, lifecycle exit, or suppression reason.`);
    whatToDo.push('Compare qualification and follow-up history by lead source before changing acquisition spend.');
    whatToDo.push('Flag customer accounts >45 days without activity for explicit re-engagement or lifecycle exit.');

    return { whatChanged, whyItMatters, whatToDo };
  }, [leadStats]);

  if (loading) {
    return (
      <div className="flex justify-center py-20" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" aria-hidden="true" />
        <span className="sr-only">Loading CRM reports</span>
      </div>
    );
  }

  const winLoss = pipeline.filter((p) => p.stage.includes('closed'));

  return (
    <div className="p-4 space-y-5 md:space-y-6 overflow-y-auto pb-24 ac-scroll-full">
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ws-text-muted)]">CRM</p>
        <h1 className="mt-1 text-[1.375rem] font-bold tracking-tight text-[var(--ws-text-primary)]">Relationships & conversions</h1>
        <p className="mt-1 text-[13px] text-[var(--ws-text-secondary)] max-w-2xl">
          Lead health · qualification · funnel conversion · relationship engagement.
        </p>
      </div>

      <section className="grid grid-cols-1 min-[576px]:grid-cols-3 gap-3 md:gap-4" aria-label="CRM KPIs">
        <IntelligentKpiCard
          label="Total leads"
          current={leadStats.total}
          previous={leadStats.total}
          referencePeriod="Current CRM snapshot"
          href="/dashboard/leads"
          icon={Users}
          iconColor="#14b8a6"
          isBetterHigher
          compact
        />
        <IntelligentKpiCard
          label="Qualified"
          current={leadStats.qualified}
          previous={leadStats.qualified}
          referencePeriod="Current CRM snapshot"
          href="/dashboard/leads?status=qualified"
          icon={TrendingUp}
          iconColor="#10b981"
          isBetterHigher
          compact
        />
        <IntelligentKpiCard
          label="Conversion %"
          current={leadStats.conversion ?? 0}
          previous={leadStats.conversion ?? 0}
          referencePeriod={leadStats.conversionUnavailable || 'Current CRM snapshot'}
          href="/dashboard/leads"
          icon={BarChart3}
          iconColor="#06b6d4"
          isBetterHigher
          isPercentage
          compact
        />
      </section>

      {(leadStats.stale > 0 || leadStats.conversion != null && leadStats.conversion < 2) ? (
        <section
          className={cn(
            'rounded-lg border p-4',
            leadStats.stale > 0 && leadStats.stale / Math.max(leadStats.total, 1) > 0.25
              ? 'border-[var(--error-border)] bg-[var(--error-bg)]'
              : 'border-[var(--warning-border)] bg-[var(--warning-bg)]',
          )}
          aria-label="CRM attention"
        >
          <div className="flex items-start gap-3">
            <span className={cn(
              'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              leadStats.stale / Math.max(leadStats.total, 1) > 0.25 ? 'bg-[var(--error-text)]/15 text-[var(--error-text)]' : 'bg-[var(--warning-text)]/15 text-[var(--warning-text)]',
            )}>
              {leadStats.stale / Math.max(leadStats.total, 1) > 0.25 ? <AlertCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[var(--ws-text-primary)]">
                {leadStats.stale > 0
                  ? `${leadStats.stale} stale lead${leadStats.stale !== 1 ? 's' : ''} — 30+ days without action`
                  : `Conversion is ${leadStats.conversion}% — qualification bottleneck likely`}
              </p>
              <p className="mt-1 text-[12px] text-[var(--ws-text-secondary)]">
                {leadStats.stale > 0
                  ? 'These records need a documented follow-up, lifecycle exit, or suppression decision so they do not disappear from the process.'
                  : 'Inspect source, qualification, and activity evidence before increasing acquisition spend.'}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <BottleneckDetector funnelStages={leadFunnel} multiplierName="customers" />

      <section className={cn(WORKSPACE.panel.base, 'p-4 md:p-5')}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13.5px] font-bold text-[var(--ws-text-primary)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--brand-violet-400)]" />
            Lead → customer funnel
          </h3>
        </div>
        <FunnelVisualization stages={leadFunnel} showBenchmarks={false} />
      </section>

      <section className={cn(WORKSPACE.panel.base, 'p-4 md:p-5')}>
        <h3 className="text-[13.5px] font-bold text-[var(--ws-text-primary)] mb-4">Pipeline by stage</h3>
        <WrapChart height={220}>
          <BarChart data={pipeline} margin={{ left: -12, right: 8 }}>
            <XAxis dataKey="stage" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
            <Bar dataKey="totalValue" fill="#14b8a6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </WrapChart>
      </section>

      {winLoss.length > 0 && (
        <section className={cn(WORKSPACE.panel.base, 'p-4 md:p-5')}>
          <h3 className="text-[13.5px] font-bold text-[var(--ws-text-primary)] mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--success-text)]" />
            Win / loss — closed deals
          </h3>
          <WrapChart height={200}>
            <PieChart>
              <Pie data={winLoss} dataKey="count" nameKey="stage" cx="50%" cy="50%" outerRadius={70}>
                {winLoss.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
            </PieChart>
          </WrapChart>
        </section>
      )}

      <BonnieBrief
        whatChanged={crmBonnie.whatChanged}
        whyItMatters={crmBonnie.whyItMatters}
        whatToDo={crmBonnie.whatToDo}
      />

      <button
        type="button"
        onClick={() => window.open('/dashboard/business/reports', '_self')}
        className="w-full flex items-center justify-center gap-2 min-h-11 rounded-lg border border-teal-500/30 text-teal-400 text-[13px] font-bold hover:bg-teal-500/10 transition"
      >
        <Download className="w-4 h-4" aria-hidden="true" /> Export full revenue report
      </button>
    </div>
  );
}
