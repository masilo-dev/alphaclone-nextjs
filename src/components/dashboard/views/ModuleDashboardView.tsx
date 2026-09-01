'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useMetricDateRange } from '@/hooks/useMetricDateRange';
import { PlatformKpiGrid, MetricDateRangeSelector, ModuleKpiRichSections } from '@/components/dashboard/metrics';
import { PlatformKpiCardSkeleton } from '@/components/dashboard/metrics/PlatformKpiCard';
import { DashboardLineChart } from '../DashboardLineChart';
import { DashboardBarChart } from '../DashboardBarChart';
import { DASHBOARD_COLORS } from '@/types/dashboardStats';
import type { ModuleDashboardId } from '@/config/moduleDashboardActions';
import { resolveModuleActions } from '@/config/moduleDashboardActions';
import { cn } from '@/lib/utils';
import { BarChart3, Bot, Briefcase, CheckSquare, ChevronRight, Cpu, FileText, Mail, MessageCircle, Phone, Receipt, Sparkles, Trophy, Users, Zap } from 'lucide-react';
import { CrmSyncToolbar } from '../crm/CrmSyncToolbar';
import { ModuleOverviewChrome } from '@/components/ui/os/ModuleOverviewChrome';
import { CHART_COLORS } from '@/constants/brand';
import { OutreachLifecyclePanel } from '@/components/dashboard/outreach/OutreachLifecyclePanel';
import { ExecutionDecisionGuide } from '@/components/dashboard/ExecutionDecisionGuide';

interface ModuleDashboardViewProps {
  moduleId: ModuleDashboardId;
  endpoint: string;
  chartType?: 'line' | 'bar' | 'dual-bar';
  chartColor?: string;
  valuePrefix?: string;
  dualBar?: boolean;
  chartTitle?: string;
  chartSubtitle?: string;
}

function ChartSkeleton() {
  return (
    <div className="ac-workspace-panel ac-chart-enter p-5 min-h-[280px] ac-skeleton-pulse">
      <div className="h-3 w-28 bg-slate-800 rounded mb-2" />
      <div className="h-2.5 w-40 bg-slate-800/70 rounded mb-6" />
      <div className="h-[200px] bg-slate-800/40 rounded-lg" />
    </div>
  );
}

function DashboardContent({
  moduleId,
  endpoint,
  chartType = 'line',
  chartColor,
  valuePrefix,
  dualBar = false,
  chartTitle,
  chartSubtitle,
}: ModuleDashboardViewProps) {
  const { currentTenant, getDashboardStats } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const { preset, setPeriod, comparisonLabel } = useMetricDateRange('last_30_days');
  const { data, loading, isValidating, error } = useDashboardStats(currentTenant?.id, endpoint, preset);
  const [workspaceStats, setWorkspaceStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!currentTenant?.id || !user?.id) return;
    void getDashboardStats(currentTenant.id, user.id)
      .then((r) => setWorkspaceStats((r.stats ?? null) as Record<string, unknown> | null))
      .catch(() => {});
  }, [currentTenant?.id, user?.id, getDashboardStats]);

  if (loading && !data) {
    return (
      <div className="space-y-4 ac-scroll-full ac-module-section">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <PlatformKpiCardSkeleton key={i} className="ac-metric-enter" />
          ))}
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  if (error || !data) {
    const { actions: errActions } = resolveModuleActions(moduleId, user?.role ?? 'client');
    const errWorkspace = errActions.find((a) => a.primary) ?? errActions[0];
    return (
      <div className="ac-scroll-full ac-module-section">
        <div className="ac-workspace-panel p-8 text-center">
          <p className="text-[13px] text-[var(--ws-text-secondary)]">Could not load metrics</p>
          {errWorkspace ? (
            <button
              type="button"
              onClick={() => router.push(errWorkspace.resolvedHref)}
              className="ac-workspace-action-btn ac-workspace-action-btn--primary mt-4"
            >
              {errWorkspace.label}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const { actions, executionSteps } = resolveModuleActions(moduleId, user?.role ?? 'client');
  const workspaceAction = actions.find((a) => a.primary) ?? actions[0];
  const allMetrics = [...data.metrics, ...(data.metricsRowB ?? [])];
  const allMetricsZero = allMetrics.every((m) => Number(m.value) === 0 || m.value === '0' || m.value === '0%');

  const overviewQuickModules =
    moduleId === 'overview'
      ? [
          { label: 'CRM', href: '/dashboard/crm', Icon: Users },
          { label: 'Deals', href: '/dashboard/deals', Icon: Zap },
          { label: 'Projects', href: '/dashboard/projects', Icon: Briefcase },
          { label: 'Tasks', href: '/dashboard/tasks', Icon: CheckSquare },
          { label: 'Invoicing', href: '/dashboard/business/billing', Icon: FileText },
          { label: 'Quotes', href: '/dashboard/quotes', Icon: Receipt },
          { label: 'Accounting', href: '/dashboard/accounting', Icon: BarChart3 },
          { label: 'Messages', href: '/dashboard/messages', Icon: MessageCircle },
          { label: 'WhatsApp', href: '/dashboard/business/whatsapp', Icon: Phone },
          { label: 'Social', href: '/dashboard/business/social', Icon: Sparkles },
          { label: 'Campaigns', href: '/dashboard/business/campaigns', Icon: Mail },
          { label: 'AI Agents', href: '/dashboard/sales-agent', Icon: Cpu },
        ]
      : null;

  const overviewNextSteps =
    moduleId === 'overview'
      ? [
          {
            label: 'Recommended',
            title: 'Run your first useful workflow',
            description: 'Start with CRM, billing, or messages so the workspace has enough activity to generate better advice.',
            href: workspaceAction?.resolvedHref || '/dashboard/crm',
            Icon: Users,
            cta: workspaceAction?.label || 'Open workspace',
            featured: true,
          },
          {
            label: 'Bonnie help',
            title: 'Ask Bonnie for practical advice',
            description: 'Use Bonnie to summarise priorities, chase unpaid invoices, or suggest the next campaign to run.',
            href: '/dashboard/bonnie',
            Icon: Bot,
            cta: 'Open Bonnie',
            featured: false,
          },
          {
            label: 'Progress',
            title: 'Track streaks and progress',
            description: 'See momentum, activity goals, and streaks so the workspace feels alive instead of empty.',
            href: '/dashboard/gamification',
            Icon: Trophy,
            cta: 'View progress',
            featured: false,
          },
        ]
      : null;

  return (
    <div className={cn('ac-scroll-full ac-module-section space-y-4', isValidating ? 'opacity-95' : '')}>
      {moduleId === 'overview' && allMetricsZero ? (
        <p className="text-[12px] text-[var(--ws-text-tertiary)] px-0.5">
          No activity yet — use the checklist above to add your first client.
        </p>
      ) : null}
      {overviewNextSteps ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {overviewNextSteps.map(({ label, title, description, href, Icon, cta, featured }) => (
            <button
              key={`${label}-${href}`}
              type="button"
              onClick={() => router.push(href)}
              className={cn(
                'ac-workspace-panel rounded-lg p-4 text-left transition-all',
                featured
                  ? 'border-teal-500/30 bg-teal-500/5 hover:border-teal-500/40'
                  : 'hover:border-[var(--brand-blue-500)]/20 hover:bg-slate-900/70'
              )}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  featured ? 'bg-teal-500/15 text-teal-300' : 'bg-[var(--brand-blue-500)]/10 text-[var(--brand-blue-400)]'
                )}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className={cn(
                  'text-[11px] font-black uppercase tracking-widest',
                  featured ? 'text-teal-300' : 'text-[var(--brand-blue-400)]'
                )}>{label}</span>
              </div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{description}</p>
              <span className={cn(
                'mt-4 inline-flex items-center gap-1 text-[12px] font-bold',
                featured ? 'text-teal-300' : 'text-[var(--brand-blue-400)]'
              )}>
                {cta}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {executionSteps.length ? (
        <ExecutionDecisionGuide
          steps={executionSteps}
          onNavigate={(href) => router.push(href)}
        />
      ) : null}
      <div className="flex items-center justify-end gap-2">
        {workspaceAction ? (
          <button
            type="button"
            onClick={() => router.push(workspaceAction.resolvedHref)}
            className="ac-workspace-action-btn ac-workspace-action-btn--primary text-[11px] min-h-8 px-2.5"
          >
            {workspaceAction.label}
            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <MetricDateRangeSelector value={preset} onChange={setPeriod} compact />

      <ModuleKpiRichSections
        data={data}
        comparisonLabel={comparisonLabel}
        showPlatformHealth={moduleId === 'overview'}
      />

      <div className="ac-chart-enter">
        {chartType === 'line' ? (
          <DashboardLineChart
            data={data.mainChart}
            color={chartColor}
            moduleId={moduleId}
            valuePrefix={valuePrefix}
            title={chartTitle}
            subtitle={chartSubtitle}
            emptyTitle="No trend data yet"
            emptyDescription="Work in this module and the chart will show movement here."
            emptyActionLabel={workspaceAction?.label}
            onEmptyAction={workspaceAction ? () => router.push(workspaceAction.resolvedHref) : undefined}
          />
        ) : (
          <DashboardBarChart
            data={data.mainChart}
            color={chartColor}
            moduleId={moduleId}
            dual={dualBar}
            valuePrefix={valuePrefix}
            title={chartTitle}
            subtitle={chartSubtitle}
            emptyTitle="No volume data yet"
            emptyDescription="Create records in this module and the graph will fill in automatically."
            emptyActionLabel={workspaceAction?.label}
            onEmptyAction={workspaceAction ? () => router.push(workspaceAction.resolvedHref) : undefined}
          />
        )}
      </div>

      {overviewQuickModules ? (
        <div className="ac-workspace-panel rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Workspace Modules</span>
            <button
              type="button"
              onClick={() => router.push('/dashboard/settings')}
              className="text-[11px] text-[var(--brand-blue-400)] font-bold"
            >
              Manage
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {overviewQuickModules.map(({ label, href, Icon }) => (
              <button
                key={`${label}-${href}`}
                type="button"
                onClick={() => router.push(href)}
                className="h-10 rounded-lg bg-slate-950/40 border border-white/5 hover:border-white/10 transition-all flex items-center justify-center gap-2 min-w-0 px-2"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                aria-label={label}
              >
                <Icon className="w-4 h-4 shrink-0 text-[var(--brand-blue-400)]" />
                <span className="text-[10px] font-bold text-slate-300 truncate">{label}</span>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-500 mt-3">
            Tip: Tap a module tile to jump straight into CRM, Deals, Invoicing, and more.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ModuleDashboardView(props: ModuleDashboardViewProps) {
  return <DashboardContent {...props} />;
}

export function OverviewDashboard() {
  return (
    <ModuleDashboardView
      moduleId="overview"
      endpoint="/api/dashboard/overview"
      chartType="line"
      chartColor={DASHBOARD_COLORS.green}
      valuePrefix="$"
      chartTitle="Revenue"
      chartSubtitle="Last 6 months"
    />
  );
}

export function CrmDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const quickAdd = searchParams?.get('quickAdd');
  useEffect(() => {
    if (quickAdd === 'true') {
      router.replace('/dashboard/crm/workspace?quickAdd=true');
    }
  }, [router, quickAdd]);

  return (
    <ModuleOverviewChrome moduleId="crm" activeHref="/dashboard/crm">
      <CrmSyncToolbar />
      <ModuleDashboardView
        moduleId="crm"
        endpoint="/api/crm/stats"
        chartType="line"
        chartColor={CHART_COLORS.pipeline.won}
        chartTitle="Deals closed"
        chartSubtitle="Won by month"
      />
    </ModuleOverviewChrome>
  );
}

export function OutreachDashboard() {
  return (
    <ModuleOverviewChrome moduleId="outreach" activeHref="/dashboard/outreach">
      <ModuleDashboardView
        moduleId="outreach"
        endpoint="/api/outreach/stats"
        chartType="line"
        chartColor={CHART_COLORS.revenue.primary}
        chartTitle="Emails sent"
        chartSubtitle="Last 14 days"
      />
      <OutreachLifecyclePanel />
    </ModuleOverviewChrome>
  );
}

export function InvoicingDashboard() {
  return (
    <ModuleOverviewChrome moduleId="invoicing" activeHref="/dashboard/business/billing">
      <ModuleDashboardView
        moduleId="invoicing"
        endpoint="/api/invoices/stats"
        chartType="bar"
        chartColor={CHART_COLORS.invoice.paid}
        dualBar
        valuePrefix="$"
        chartTitle="Invoiced vs collected"
        chartSubtitle="Monthly"
      />
    </ModuleOverviewChrome>
  );
}

export function ContractsDashboard() {
  return (
    <ModuleOverviewChrome moduleId="documents" activeHref="/dashboard/business/contracts" hideSubnav>
      <ModuleDashboardView
        moduleId="contracts"
        endpoint="/api/contracts/stats"
        chartType="line"
        chartColor={CHART_COLORS.revenue.primary}
        chartTitle="Contracts signed"
        chartSubtitle="Per month"
      />
    </ModuleOverviewChrome>
  );
}

export function ProjectsDashboard() {
  return (
    <ModuleOverviewChrome moduleId="projects" activeHref="/dashboard/business/projects">
      <ModuleDashboardView
        moduleId="projects"
        endpoint="/api/projects/stats"
        chartType="bar"
        chartColor={CHART_COLORS.projectHealth.onTrack}
        chartTitle="Tasks completed"
        chartSubtitle="Weekly"
        valuePrefix=""
      />
    </ModuleOverviewChrome>
  );
}

export function SocialDashboard() {
  return (
    <ModuleOverviewChrome moduleId="social" activeHref="/dashboard/business/social">
      <ModuleDashboardView
        moduleId="social"
        endpoint="/api/social/stats"
        chartType="line"
        chartColor="#D74673"
        chartTitle="Posts published"
        chartSubtitle="Last 14 days"
      />
    </ModuleOverviewChrome>
  );
}
