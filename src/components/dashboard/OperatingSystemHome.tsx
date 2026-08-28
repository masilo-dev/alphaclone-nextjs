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
  ModuleLauncher,
  OverviewChartCard,
  TodayPanel,
  type AttentionItem,
  type ModuleLauncherItem,
  type TodayItem,
} from '@/components/ui/os';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';
import { StatePanel } from '@/components/dashboard/responsive/StatePanel';
import { buildDashboardDecisionViewModel } from '@/lib/analytics/dashboardViewModel';
import { normalizeDashboardStats } from '@/lib/analytics/normalizeDashboardStats';
import { DashboardHomeLayoutToggle } from '@/components/dashboard/DashboardHomeLayoutToggle';
import { PlatformExecutionWelcome } from '@/components/dashboard/PlatformExecutionWelcome';
import { PlatformKpiGrid, MetricDateRangeSelector } from '@/components/dashboard/metrics';
import { platformKpiFromNumbers } from '@/lib/metrics/metricPresentation';
import { useMetricDateRange } from '@/hooks/useMetricDateRange';

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
  { id: 'outreach', href: '/dashboard/outreach/inbox', purpose: 'Replies and reach inbox' },
  { id: 'reports', href: '/dashboard/business/reports', purpose: 'Business insight' },
];

export function OperatingSystemHome() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { pendingCount } = useBonnieApprovals(currentTenant?.id);
  const { brief } = useBonnieMorningBrief(currentTenant?.id);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { preset, setPeriod, comparisonLabel } = useMetricDateRange('last_30_days');

  useEffect(() => {
    if (!currentTenant?.id || !user?.id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError(null);
    const url = `/api/dashboard/stats?tenantId=${encodeURIComponent(currentTenant.id)}&period=${encodeURIComponent(preset)}`;
    void fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load dashboard stats');
        }
        return res.json();
      })
      .then((payload) => {
        if (!active) return;
        setStats((payload.stats as Record<string, unknown>) ?? null);
        setLoadError(null);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard stats');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentTenant?.id, user?.id, preset]);

  const retry = async () => {
    if (!currentTenant?.id || !user?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const url = `/api/dashboard/stats?tenantId=${encodeURIComponent(currentTenant.id)}&period=${encodeURIComponent(preset)}`;
      const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load dashboard stats');
      }
      const payload = await res.json();
      setStats((payload.stats as Record<string, unknown>) ?? null);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const firstName =
    user?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there';
  const businessName = currentTenant?.name || 'your business';
  const greeting = greetingForHour(new Date().getHours());
  const todayLabel = format(new Date(), 'EEEE, d MMMM yyyy');

  const normalizedStats = useMemo(() => normalizeDashboardStats(stats), [stats]);

  const decisionVm = useMemo(
    () => buildDashboardDecisionViewModel(normalizedStats),
    [normalizedStats],
  );

  const revenue = Number(normalizedStats.revenue ?? 0);
  const revenuePrev = Number(normalizedStats.revenuePrev ?? normalizedStats.previousRevenue ?? 0);
  const leads = Number(normalizedStats.newLeads ?? normalizedStats.totalLeads ?? 0);
  const leadsPrev = Number(normalizedStats.leadsPrev ?? normalizedStats.previousLeads ?? 0);
  const dealsWon = Number(normalizedStats.dealsWon ?? normalizedStats.closedWon ?? normalizedStats.wonDeals ?? 0);
  const dealsWonPrev = Number(normalizedStats.dealsWonPrev ?? normalizedStats.previousDealsWon ?? 0);
  const outstanding = Number(normalizedStats.outstanding ?? normalizedStats.pendingRevenue ?? 0);
  const outstandingPrev = Number(normalizedStats.outstandingPrev ?? 0);
  const tasksCompleted = Number(normalizedStats.tasksCompleted ?? normalizedStats.completedTasks ?? 0);
  const openTasks = Number(normalizedStats.openTasks ?? normalizedStats.open_tasks ?? 0);
  const overdueInvoices = Number(normalizedStats.overdueInvoices ?? normalizedStats.overdue_invoices ?? 0);

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
    (Array.isArray(brief?.attentionItems) ? brief.attentionItems : []).slice(0, 2).forEach((item, i) => {
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
    const meetings = Array.isArray(stats?.upcomingMeetings)
      ? (stats.upcomingMeetings as Array<{ id?: string; title?: string; time?: string }>)
      : [];
    meetings.slice(0, 3).forEach((m, i) => {
      items.push({
        id: m.id || `meeting-${i}`,
        label: m.title || 'Meeting',
        meta: m.time,
        href: '/dashboard/business/calendar',
        kind: 'meeting',
      });
    });
    const dueTasks = Array.isArray(stats?.tasksDueToday)
      ? (stats.tasksDueToday as Array<{ id?: string; title?: string }>)
      : [];
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
              ? `${leads.toLocaleString()} in pipeline · ${decisionVm.kpis.qualifiedLeads.current.toLocaleString()} qualified`
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
    const series = Array.isArray(stats?.revenueSeries)
      ? (stats.revenueSeries as Array<{ label?: string; value?: number; secondary?: number }>)
      : [];
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
    const stages = Array.isArray(stats?.pipelineStages)
      ? (stats.pipelineStages as Array<{ stage?: string; label?: string; count?: number; value?: number }>)
      : [];
    if (stages.length) {
      return stages.map((s) => ({
        label: s.label || s.stage || 'Stage',
        value: Number(s.count ?? s.value ?? 0),
      }));
    }
    return (Array.isArray(decisionVm?.funnelStages) ? decisionVm.funnelStages : []).map((s) => ({ label: s.label, value: s.count }));
  }, [stats, decisionVm.funnelStages]);

  const completionSeries = useMemo(() => {
    const series = Array.isArray(stats?.completionSeries)
      ? (stats.completionSeries as Array<{ label?: string; value?: number }>)
      : [];
    if (series.length) {
      return series.map((p) => ({ label: p.label || '', value: Number(p.value || 0) }));
    }
    return [{ label: 'Completed', value: tasksCompleted }];
  }, [stats, tasksCompleted]);

  const revenueTrend = [revenuePrev * 0.8, revenuePrev, revenuePrev * 0.95, revenue * 0.9, revenue];
  const leadsTrend = [leadsPrev * 0.7, leadsPrev * 0.9, leadsPrev, leads * 0.85, leads];

  const upcomingMeetingsCount = Array.isArray(stats?.upcomingMeetings)
    ? (stats.upcomingMeetings as unknown[]).length
    : null;
  const tasksAttention = openTasks + (Number(normalizedStats.missedTasks) || 0);
  const conversionCurrent = decisionVm.kpis.conversionRate.current;
  const conversionPrev = decisionVm.kpis.conversionRate.previous;

  const homeKpis = useMemo(
    () => [
      platformKpiFromNumbers({
        metricId: 'home.total_revenue',
        label: 'Total revenue',
        current: revenue,
        previous: revenuePrev,
        referencePeriod: comparisonLabel,
        trend: revenueTrend,
        state: loading ? 'loading' : revenue == null ? 'empty' : 'ready',
      }),
      platformKpiFromNumbers({
        metricId: 'home.new_leads',
        label: 'New leads',
        current: leads,
        previous: leadsPrev,
        referencePeriod: comparisonLabel,
        trend: leadsTrend,
        state: loading ? 'loading' : 'ready',
      }),
      platformKpiFromNumbers({
        metricId: 'home.conversion_rate',
        label: 'Conversion rate',
        current: conversionCurrent,
        previous: conversionPrev,
        isPercentage: true,
        referencePeriod: comparisonLabel,
        state: loading ? 'loading' : leads === 0 && leadsPrev === 0 ? 'empty' : 'ready',
      }),
      platformKpiFromNumbers({
        metricId: 'home.outstanding_invoices',
        label: 'Outstanding invoices',
        current: outstanding,
        previous: outstandingPrev,
        formattedValue: money(outstanding),
        referencePeriod: comparisonLabel,
        state: loading ? 'loading' : 'ready',
      }),
      platformKpiFromNumbers({
        metricId: 'home.upcoming_meetings',
        label: 'Upcoming meetings',
        current: upcomingMeetingsCount,
        referencePeriod: 'Next 7 days',
        state: loading ? 'loading' : upcomingMeetingsCount == null ? 'empty' : 'ready',
      }),
      platformKpiFromNumbers({
        metricId: 'home.tasks_attention',
        label: 'Tasks requiring attention',
        current: tasksAttention,
        referencePeriod: comparisonLabel,
        state: loading ? 'loading' : 'ready',
      }),
      platformKpiFromNumbers({
        label: 'Deals won',
        current: dealsWon,
        previous: dealsWonPrev,
        referencePeriod: comparisonLabel,
        href: '/dashboard/deals',
        state: loading ? 'loading' : 'ready',
      }),
      platformKpiFromNumbers({
        metricId: 'invoices.overdue_invoices',
        label: 'Overdue invoices',
        current: overdueInvoices,
        referencePeriod: comparisonLabel,
        state: loading ? 'loading' : 'ready',
      }),
    ],
    [
      loading,
      revenue,
      revenuePrev,
      leads,
      leadsPrev,
      conversionCurrent,
      conversionPrev,
      outstanding,
      outstandingPrev,
      upcomingMeetingsCount,
      tasksAttention,
      dealsWon,
      dealsWonPrev,
      overdueInvoices,
      comparisonLabel,
      revenueTrend,
      leadsTrend,
    ],
  );


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
      {user?.id ? <PlatformExecutionWelcome userId={user.id} surface="home" /> : null}
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
          <DashboardHomeLayoutToggle />
          <MetricDateRangeSelector value={preset} onChange={setPeriod} compact className="mb-0" />
          <a
            href="/dashboard/business/settings"
            className={WORKSPACE.action.secondary}
          >
            Customise
          </a>
          <a
            href="/dashboard/crm?quickAdd=true"
            className={WORKSPACE.action.secondary}
          >
            Add contact
          </a>
        </div>
      </header>

      <PlatformKpiGrid
        items={homeKpis.map((item) => ({
          ...item,
          compact: true,
          formattedValue: item.metricId === 'home.total_revenue' ? money(revenue) : item.formattedValue,
        }))}
        loading={loading}
        skeletonCount={8}
        className="ac-metric-enter"
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 md:gap-5">
        <div className="space-y-4 md:space-y-5 min-w-0">
          {attentionItems.length > 0 ? (
            <AttentionPanel items={attentionItems} />
          ) : null}

          <OverviewChartCard
            revenue={revenueSeries}
            pipeline={pipelineSeries}
            completion={completionSeries}
            loading={loading}
          />

          <ModuleLauncher items={modules} />
        </div>
        <div className="space-y-4 md:space-y-5">
          <TodayPanel items={todayItems} className="xl:sticky xl:top-4 h-fit" />
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
