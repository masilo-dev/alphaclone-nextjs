'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBonnieApprovals } from '@/hooks/useBonnieApprovals';
import { useBonnieMorningBrief } from '@/hooks/useBonnieMorningBrief';
import { HUMAN_LABELS } from '@/lib/copy/humanLabels';
import {
  AttentionPanel,
  KpiCardSkeleton,
  ModuleLauncher,
  OverviewChartCard,
  TodayPanel,
  type AttentionItem,
  type ModuleLauncherItem,
  type TodayItem,
} from '@/components/ui/os';
import {
  IconInvoicing,
  IconLeads,
  IconPipeline,
  IconTasks,
  IconMoney,
  IconCrm,
} from '@/components/icons/alphaclone';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';
import { BacklitSurface } from '@/components/ui/os/BacklitSurface';
import { StatePanel } from '@/components/dashboard/responsive/StatePanel';
import { buildDashboardDecisionViewModel } from '@/lib/analytics/dashboardViewModel';
import {
  IntelligentKpiCard,
  MaterialChangesStrip,
  BonnieBrief,
  BottleneckDetector,
  OpportunityHighlight,
  FunnelVisualization,
} from '@/components/ui/intelligence';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function money(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

const DEFAULT_MODULES: ModuleLauncherItem[] = [
  { id: 'crm', href: '/dashboard/crm', purpose: 'Relationships and customer health' },
  { id: 'leads', href: '/dashboard/leads', purpose: 'Capture and qualify opportunities' },
  { id: 'pipeline', href: '/dashboard/deals', purpose: 'Move deals to close' },
  { id: 'invoicing', href: '/dashboard/business/billing', purpose: 'Bill and collect' },
  { id: 'projects', href: '/dashboard/business/projects', purpose: 'Deliver the work' },
  { id: 'tasks', href: '/dashboard/tasks', purpose: 'Complete what matters today' },
  { id: 'calendar', href: '/dashboard/business/calendar', purpose: 'Protect your time' },
  { id: 'documents', href: '/dashboard/business/documents', purpose: 'Files and knowledge' },
  { id: 'marketing', href: '/dashboard/business/campaigns', purpose: 'Campaign performance' },
  { id: 'reports', href: '/dashboard/business/reports', purpose: 'Business insight' },
];

export function OperatingSystemHome() {
  const { currentTenant, getDashboardStats } = useTenant();
  const { user } = useAuth();
  const { pendingCount } = useBonnieApprovals(currentTenant?.id);
  const { brief } = useBonnieMorningBrief(currentTenant?.id);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTenant?.id || !user?.id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError(null);
    void getDashboardStats(currentTenant.id, user.id)
      .then((r) => {
        if (!active) return;
        setStats((r.stats as Record<string, unknown>) ?? null);
        setLoadError(r.error ?? null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentTenant?.id, user?.id, getDashboardStats]);

  const retry = async () => {
    if (!currentTenant?.id || !user?.id) return;
    setLoading(true);
    setLoadError(null);
    const r = await getDashboardStats(currentTenant.id, user.id, true);
    setStats((r.stats as Record<string, unknown>) ?? null);
    setLoadError(r.error ?? null);
    setLoading(false);
  };

  const firstName =
    user?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there';
  const businessName = currentTenant?.name || 'your business';
  const greeting = greetingForHour(new Date().getHours());
  const todayLabel = format(new Date(), 'EEEE, d MMMM yyyy');

  const decisionVm = useMemo(
    () => buildDashboardDecisionViewModel(stats),
    [stats],
  );

  const revenue = Number(stats?.revenue ?? stats?.totalRevenue ?? 0);
  const revenuePrev = Number(stats?.revenuePrev ?? stats?.previousRevenue ?? 0);
  const leads = Number(
    stats?.newLeads ??
      stats?.leads ??
      stats?.leadsCount ??
      stats?.newLeads24h ??
      stats?.totalLeads ??
      0
  );
  const leadsPrev = Number(stats?.leadsPrev ?? stats?.previousLeads ?? 0);
  const dealsWon = Number(
    stats?.dealsWon ??
      stats?.closedWon ??
      stats?.dealsClosed ??
      stats?.dealsWonCount ??
      stats?.wonDeals ??
      0
  );
  const dealsWonPrev = Number(stats?.dealsWonPrev ?? stats?.previousDealsWon ?? 0);
  const outstanding = Number(
    stats?.outstanding ??
      stats?.outstandingInvoices ??
      stats?.outstandingAmount ??
      stats?.pendingRevenue ??
      stats?.pendingAmount ??
      0
  );
  const outstandingPrev = Number(stats?.outstandingPrev ?? 0);
  const tasksCompleted = Number(stats?.tasksCompleted ?? stats?.completedTasks ?? 0);
  const tasksCompletedPrev = Number(stats?.tasksCompletedPrev ?? 0);
  const openTasks = Number(
    stats?.openTasks ??
      stats?.open_tasks ??
      Math.max(0, Number(stats?.totalTasks ?? 0) - Number(stats?.completedTasks ?? stats?.tasksCompleted ?? 0))
  );
  const overdueInvoices = Number(stats?.overdueInvoices ?? stats?.overdue_invoices ?? 0);

  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];
    for (const flag of decisionVm.attentionFlags) {
      items.push({
        id: flag.id,
        reason: flag.label,
        record: flag.detail,
        href: flag.href,
        actionLabel: flag.kind === 'overdue_invoices' ? 'Collect payment' : flag.kind === 'broken_integrations' ? 'Repair' : 'Review',
        severity: flag.severity,
      });
    }
    if (pendingCount > 0) {
      items.unshift({
        id: 'approvals',
        reason: `${pendingCount} Bonnie action${pendingCount > 1 ? 's' : ''} awaiting confirmation`,
        href: '/dashboard/business/bonnie/approvals',
        actionLabel: 'Review approvals',
        severity: 'high',
      });
    }
    (brief?.attentionItems || []).slice(0, 2).forEach((item, i) => {
      if (items.length >= 6) return;
      items.push({
        id: `brief-${i}`,
        reason: item,
        href: '/dashboard/business/bonnie',
        actionLabel: 'Ask Bonnie',
        severity: 'medium',
      });
    });
    if (items.length === 0 && openTasks > 0) {
      items.push({
        id: 'tasks-fallback',
        reason: HUMAN_LABELS.taskBacklog,
        record: `${openTasks} open task${openTasks !== 1 ? 's' : ''}`,
        href: '/dashboard/tasks',
        actionLabel: 'Work tasks',
        severity: 'medium',
      });
    }
    return items;
  }, [pendingCount, overdueInvoices, openTasks, brief?.attentionItems, decisionVm.attentionFlags]);

  const todayItems: TodayItem[] = useMemo(() => {
    const items: TodayItem[] = [];
    const meetings = (stats?.upcomingMeetings as Array<{ id?: string; title?: string; time?: string }>) || [];
    meetings.slice(0, 3).forEach((m, i) => {
      items.push({
        id: m.id || `meeting-${i}`,
        label: m.title || 'Meeting',
        meta: m.time,
        href: '/dashboard/business/calendar',
        kind: 'meeting',
      });
    });
    const dueTasks = (stats?.tasksDueToday as Array<{ id?: string; title?: string }>) || [];
    dueTasks.slice(0, 3).forEach((t, i) => {
      items.push({
        id: t.id || `task-${i}`,
        label: t.title || 'Task due today',
        href: '/dashboard/tasks',
        kind: 'task',
      });
    });
    if (items.length === 0 && openTasks > 0) {
      items.push({
        id: 'open-tasks',
        label: `${openTasks} open task${openTasks > 1 ? 's' : ''} in progress`,
        href: '/dashboard/tasks',
        kind: 'task',
      });
    }
    return items;
  }, [stats, openTasks]);

  const modules: ModuleLauncherItem[] = useMemo(
    () =>
      DEFAULT_MODULES.map((m) => ({
        ...m,
        summary:
          m.id === 'crm'
            ? `${decisionVm.kpis.activeCustomers.valueFormatted} active`
            : m.id === 'leads'
              ? `${decisionVm.kpis.newLeads.current.toLocaleString()} new · ${decisionVm.kpis.qualifiedLeads.current.toLocaleString()} qualified`
              : m.id === 'pipeline'
                ? `${dealsWon} won · ${formatMoney0(decisionVm.pipelineSummary.weightedValue)} EV`
                : m.id === 'invoicing'
                  ? money(outstanding)
                  : m.id === 'tasks'
                    ? `${tasksCompleted} done`
                    : m.purpose,
      })),
    [dealsWon, outstanding, tasksCompleted, decisionVm]
  );

  const revenueSeries = useMemo(() => {
    const series = (stats?.revenueSeries as Array<{ label?: string; value?: number; secondary?: number }>) || [];
    if (series.length) {
      return series.map((p) => ({
        label: p.label || '',
        value: Number(p.value || 0),
        secondary: Number(p.secondary || 0),
      }));
    }
    return [
      { label: 'Now', value: revenue, secondary: revenuePrev },
    ];
  }, [stats, revenue, revenuePrev]);

  const pipelineSeries = useMemo(() => {
    const stages =
      (stats?.pipelineStages as Array<{ stage?: string; label?: string; count?: number; value?: number }>) ||
      [];
    if (stages.length) {
      return stages.map((s) => ({
        label: s.label || s.stage || 'Stage',
        value: Number(s.count ?? s.value ?? 0),
      }));
    }
    return decisionVm.funnelStages.map((s) => ({ label: s.label, value: s.count }));
  }, [stats, decisionVm.funnelStages]);

  const completionSeries = useMemo(() => {
    const series =
      (stats?.completionSeries as Array<{ label?: string; value?: number }>) || [];
    if (series.length) {
      return series.map((p) => ({ label: p.label || '', value: Number(p.value || 0) }));
    }
    return [{ label: 'Completed', value: tasksCompleted }];
  }, [stats, tasksCompleted]);

  const revenueTrend = [revenuePrev * 0.8, revenuePrev, revenuePrev * 0.95, revenue * 0.9, revenue];
  const leadsTrend = [leadsPrev * 0.7, leadsPrev * 0.9, leadsPrev, leads * 0.85, leads];
  const tasksTrend = [tasksCompletedPrev * 0.6, tasksCompletedPrev * 0.8, tasksCompletedPrev, tasksCompleted * 0.9, tasksCompleted];


  if (!currentTenant?.id) {
    return (
      <div className="space-y-5 ac-scroll-full pb-24 ac-safe-bottom" data-tour="os-home">
        <StatePanel
          kind="empty"
          title="Select a workspace to load your dashboard"
          description="Choose a workspace from the top bar so AlphaClone can load your KPIs and activity."
          actions={[
            { label: 'Open workspace settings', href: '/dashboard/business/settings', primary: true },
          ]}
        />
      </div>
    );
  }

  if (!loading && loadError) {
    const kind =
      /forbidden/i.test(loadError) || /unauthorized/i.test(loadError)
        ? 'permission'
        : /failed to fetch/i.test(loadError) || /network/i.test(loadError)
          ? 'network'
          : 'error';
    return (
      <div className="space-y-5 ac-scroll-full pb-24 ac-safe-bottom" data-tour="os-home">
        <StatePanel
          kind={kind}
          title="Workspace dashboard data is not loading"
          description={loadError}
          actions={[
            { label: 'Retry', onClick: () => void retry(), primary: true },
            { label: 'Open CRM', href: '/dashboard/crm' },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 ac-scroll-full pb-24 ac-safe-bottom" data-tour="os-home">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--ws-text-muted)]">{todayLabel}</p>
          <h1 className={cn(WORKSPACE.typography.pageTitle, 'mt-1')}>
            {greeting}, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--ws-text-secondary)] max-w-2xl">
            Here is what needs your attention across {businessName} today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-9 items-center rounded-[8px] border border-[var(--ws-border)] px-3 text-xs font-medium text-[var(--ws-text-secondary)]">
            Last 30 days
          </span>
          <a
            href="/dashboard/business/settings"
            className={WORKSPACE.action.secondary}
          >
            Customise
          </a>
          <a href="/dashboard/crm" className={WORKSPACE.action.primary}>
            Create
          </a>
        </div>
      </header>

      <section
        className="grid grid-cols-1 min-[576px]:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
        aria-label="Business pulse key performance indicators"
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <IntelligentKpiCard
              label="Revenue collected"
              current={revenue}
              previous={revenuePrev}
              href="/dashboard/business/billing"
              icon={IconMoney}
              iconColor="#168C5C"
              trend={revenueTrend}
              isBetterHigher
              showNarrative
            />
            <IntelligentKpiCard
              label="New leads"
              current={leads}
              previous={leadsPrev}
              href="/dashboard/leads"
              icon={IconLeads}
              iconColor="#3196E8"
              trend={leadsTrend}
              isBetterHigher
              showNarrative
            />
            <IntelligentKpiCard
              label="Deals won"
              current={dealsWon}
              previous={dealsWonPrev}
              href="/dashboard/deals"
              icon={IconPipeline}
              iconColor="#E69222"
              isBetterHigher
              showNarrative
            />
            <IntelligentKpiCard
              label="Outstanding A/R"
              current={outstanding}
              previous={outstandingPrev}
              href="/dashboard/business/billing/manage"
              icon={IconInvoicing}
              iconColor="#149C86"
              isBetterHigher={false}
              showNarrative
            />
            <div className="min-[576px]:col-span-2 lg:col-span-4 grid grid-cols-1 min-[576px]:grid-cols-3 gap-3 md:gap-4 pt-1 border-t border-white/[0.03]">
              <IntelligentKpiCard
                label="Tasks completed"
                current={tasksCompleted}
                previous={tasksCompletedPrev}
                href="/dashboard/tasks"
                icon={IconTasks}
                iconColor="#0F9F8F"
                trend={tasksTrend}
                compact
              />
              <IntelligentKpiCard
                label="Active customers"
                current={decisionVm.kpis.activeCustomers.current}
                previous={decisionVm.kpis.activeCustomers.previous}
                href="/dashboard/contacts"
                icon={IconCrm}
                iconColor="#7F56D9"
                compact
              />
              <IntelligentKpiCard
                label="Lead → win rate"
                current={decisionVm.kpis.conversionRate.current}
                previous={decisionVm.kpis.conversionRate.previous}
                href="/dashboard/deals"
                isPercentage
                compact
              />
            </div>
          </>
        )}
      </section>

      {!loading && decisionVm.prioritizedChanges.length > 0 ? (
        <MaterialChangesStrip changes={decisionVm.materialChanges} />
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 md:gap-5">
        <div className="space-y-4 md:space-y-5 min-w-0">
          {attentionItems.length > 0 ? (
            <AttentionPanel items={attentionItems} />
          ) : null}

          {!loading && decisionVm.funnelAnalysis.bottleneck ? (
            <BottleneckDetector
              funnelStages={decisionVm.funnelStages}
              multiplierName="opportunities"
            />
          ) : null}

          <OverviewChartCard
            revenue={revenueSeries}
            pipeline={pipelineSeries}
            completion={completionSeries}
            loading={loading}
          />

          {!loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
              <FunnelVisualization
                stages={decisionVm.funnelStages}
                multiplierName="opportunities"
              />
              <OpportunityHighlight deals={decisionVm.opportunityDeals.slice(0, 3)} />
            </div>
          ) : null}

          {!loading ? (
            <BonnieBrief
              whatChanged={decisionVm.bonnieBrief.whatChanged}
              whyItMatters={decisionVm.bonnieBrief.whyItMatters}
              whatToDo={decisionVm.bonnieBrief.whatToDo}
            />
          ) : (
            <BacklitSurface tone="teal" intensity="active">
              <div className="p-4 md:p-5 space-y-2">
                <div className="h-4 w-32 bg-[var(--ws-surface-tertiary)] rounded ac-skeleton-pulse" />
                <div className="h-3 w-full bg-[var(--ws-surface-tertiary)] rounded ac-skeleton-pulse" />
                <div className="h-3 w-5/6 bg-[var(--ws-surface-tertiary)] rounded ac-skeleton-pulse" />
              </div>
            </BacklitSurface>
          )}

          <ModuleLauncher items={modules} />
        </div>
        <div className="space-y-4 md:space-y-5">
          <TodayPanel items={todayItems} className="xl:sticky xl:top-4 h-fit" />
          {!loading ? (
            <div className={cn(WORKSPACE.panel.base, 'p-4 md:p-5 h-fit')}>
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ws-text-muted)] mb-2">Pipeline summary</p>
              <div className="space-y-3 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ws-text-secondary)]">Total value</span>
                  <span className="font-bold tabular-nums text-[var(--ws-text-primary)]">{formatMoney0(decisionVm.pipelineSummary.totalValue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ws-text-secondary)]">Weighted (× prob)</span>
                  <span className="font-bold tabular-nums text-[var(--success-text)]">{formatMoney0(decisionVm.pipelineSummary.weightedValue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ws-text-secondary)]">Forecast</span>
                  <span className="font-bold tabular-nums text-[var(--brand-amber-400)]">{formatMoney0(decisionVm.pipelineSummary.forecastValue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ws-text-secondary)]">Deals</span>
                  <span className="font-bold tabular-nums text-[var(--ws-text-primary)]">{decisionVm.pipelineSummary.totalDeals}</span>
                </div>
                {decisionVm.pipelineSummary.averageDealValue > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--ws-text-secondary)]">Avg deal</span>
                    <span className="font-bold tabular-nums text-[var(--ws-text-primary)]">{formatMoney0(decisionVm.pipelineSummary.averageDealValue)}</span>
                  </div>
                ) : null}
                {decisionVm.pipelineSummary.expectedWinRate != null ? (
                  <div className="pt-2 mt-2 border-t border-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--ws-text-secondary)]">Expected win rate</span>
                      <span className="font-bold tabular-nums text-[var(--ws-text-primary)]">{decisionVm.pipelineSummary.expectedWinRate}%</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatMoney0(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

export default OperatingSystemHome;
