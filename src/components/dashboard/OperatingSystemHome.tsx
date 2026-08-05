'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBonnieApprovals } from '@/hooks/useBonnieApprovals';
import { useBonnieMorningBrief } from '@/hooks/useBonnieMorningBrief';
import { HUMAN_LABELS } from '@/lib/copy/humanLabels';
import {
  AttentionPanel,
  BonnieInsightCard,
  KpiCard,
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
} from '@/components/icons/alphaclone';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';
import { BacklitSurface } from '@/components/ui/os/BacklitSurface';
import { StatePanel } from '@/components/dashboard/responsive/StatePanel';
import { FIRST_VALUE_MODULES, isNewWorkspaceStats } from '@/lib/activation/firstValue';

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

function pct(curr: number, prev: number): number | null {
  if (!prev && !curr) return null;
  if (!prev) return 100;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
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

/**
 * Alphaclone OS home — attention-first, spacious, progressive disclosure.
 * Reuses tenant stats / Bonnie hooks; does not invent production records.
 */
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
    if (pendingCount > 0) {
      items.push({
        id: 'approvals',
        reason: `${pendingCount} Bonnie action${pendingCount > 1 ? 's' : ''} awaiting confirmation`,
        href: '/dashboard/business/bonnie/approvals',
        actionLabel: 'Review approvals',
        severity: 'high',
      });
    }
    if (overdueInvoices > 0) {
      items.push({
        id: 'overdue',
        reason: HUMAN_LABELS.overdueAR,
        record: `${overdueInvoices} invoice${overdueInvoices > 1 ? 's' : ''}`,
        href: '/dashboard/business/billing/manage',
        actionLabel: 'Collect payment',
        severity: 'high',
      });
    }
    if (openTasks > 0) {
      items.push({
        id: 'tasks',
        reason: HUMAN_LABELS.taskBacklog,
        record: `${openTasks} open task${openTasks > 1 ? 's' : ''}`,
        href: '/dashboard/tasks',
        actionLabel: 'Work tasks',
        severity: 'medium',
      });
    }
    (brief?.attentionItems || []).slice(0, 3).forEach((item, i) => {
      items.push({
        id: `brief-${i}`,
        reason: item,
        href: '/dashboard/business/bonnie',
        actionLabel: 'Ask Bonnie',
        severity: 'medium',
      });
    });
    return items;
  }, [pendingCount, overdueInvoices, openTasks, brief?.attentionItems]);

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
    () => {
      const sourceModules = isNewWorkspaceStats(stats) ? FIRST_VALUE_MODULES : DEFAULT_MODULES;
      return sourceModules.map((m) => ({
        ...m,
        summary:
          m.id === 'crm'
            ? `${Number(stats?.activeCustomers ?? stats?.contacts ?? stats?.clientCount ?? 0)} contacts`
            : m.id === 'leads'
              ? `${leads} new`
              : m.id === 'pipeline'
                ? `${dealsWon} won`
                : m.id === 'invoicing'
                  ? money(outstanding)
                  : m.id === 'tasks'
                    ? `${tasksCompleted} done`
                    : m.purpose,
      }));
    },
    [stats, leads, dealsWon, outstanding, tasksCompleted]
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
    // Synthetic empty-safe placeholder shape from current totals only — not fake history.
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
    return [
      { label: 'Leads', value: leads },
      { label: 'Won', value: dealsWon },
    ];
  }, [stats, leads, dealsWon]);

  const completionSeries = useMemo(() => {
    const series =
      (stats?.completionSeries as Array<{ label?: string; value?: number }>) || [];
    if (series.length) {
      return series.map((p) => ({ label: p.label || '', value: Number(p.value || 0) }));
    }
    return [{ label: 'Completed', value: tasksCompleted }];
  }, [stats, tasksCompleted]);

  const bonnieMessage =
    attentionItems.length > 0
      ? `Bonnie found ${attentionItems.length} item${attentionItems.length > 1 ? 's' : ''} that need follow-up activity.`
      : brief?.summary ||
        'Bonnie is monitoring deals, invoices, and tasks across your workspace.';

  return (
    <div className="space-y-5 ac-scroll-full pb-24 ac-safe-bottom" data-tour="os-home">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--ws-text-muted)]">{todayLabel}</p>
          <h1 className={cn(WORKSPACE.typography.pageTitle, 'mt-1')}>
            {greeting}, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--ws-text-secondary)] max-w-2xl">
            {isNewWorkspaceStats(stats)
              ? `Start with one customer record, one money action, and one follow-up for ${businessName}.`
              : `Here is what needs your attention across ${businessName} today.`}
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
          <a href="/dashboard/crm/workspace?quickAdd=true" className={WORKSPACE.action.primary}>
            Add client
          </a>
        </div>
      </header>

      {/* KPI row — max 5 on xl, 4 on lg */}
      <section
        className="grid grid-cols-1 min-[576px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4"
        aria-label="Key performance indicators"
      >
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Revenue"
              value={money(revenue)}
              icon={IconMoney}
              iconColor="#168C5C"
              changePercent={pct(revenue, revenuePrev)}
              href="/dashboard/business/billing"
              trend={[revenuePrev || 0, Math.max(revenuePrev * 0.9, 0), revenue]}
            />
            <KpiCard
              label="New leads"
              value={leads}
              icon={IconLeads}
              iconColor="#3196E8"
              changePercent={pct(leads, leadsPrev)}
              href="/dashboard/leads"
            />
            <KpiCard
              label="Deals won"
              value={dealsWon}
              icon={IconPipeline}
              iconColor="#E69222"
              changePercent={pct(dealsWon, dealsWonPrev)}
              href="/dashboard/deals"
            />
            <KpiCard
              label="Outstanding invoices"
              value={money(outstanding)}
              icon={IconInvoicing}
              iconColor="#149C86"
              changePercent={pct(outstanding, outstandingPrev)}
              href="/dashboard/business/billing/manage"
            />
            <div className="hidden xl:block">
              <KpiCard
                label="Tasks completed"
                value={tasksCompleted}
                icon={IconTasks}
                iconColor="#0F9F8F"
                changePercent={pct(tasksCompleted, tasksCompletedPrev)}
                href="/dashboard/tasks"
              />
            </div>
          </>
        )}
      </section>

      {/* Main + Today */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 md:gap-5">
        <div className="space-y-4 md:space-y-5 min-w-0">
          <AttentionPanel items={attentionItems} />
          <OverviewChartCard
            revenue={revenueSeries}
            pipeline={pipelineSeries}
            completion={completionSeries}
            loading={loading}
          />
          <ModuleLauncher items={modules} />
          <BacklitSurface tone="teal" intensity="active">
            <BonnieInsightCard
              message={bonnieMessage}
              actionLabel={attentionItems.length ? 'Review items' : 'Open Bonnie'}
              href={
                attentionItems.length
                  ? attentionItems[0].href
                  : '/dashboard/business/bonnie'
              }
            />
          </BacklitSurface>
        </div>
        <TodayPanel items={todayItems} className="xl:sticky xl:top-4 h-fit" />
      </div>
    </div>
  );
}

export default OperatingSystemHome;
