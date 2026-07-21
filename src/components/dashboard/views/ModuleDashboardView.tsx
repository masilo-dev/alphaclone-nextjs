'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { MetricCard, MetricCardSkeleton } from '../MetricCard';
import { DashboardLineChart } from '../DashboardLineChart';
import { DashboardBarChart } from '../DashboardBarChart';
import { DASHBOARD_COLORS } from '@/types/dashboardStats';
import type { ModuleDashboardId } from '@/config/moduleDashboardActions';
import { resolveModuleActions } from '@/config/moduleDashboardActions';
import { cn } from '@/lib/utils';
import { BarChart3, Bot, Briefcase, CheckSquare, ChevronRight, Cpu, FileText, Mail, MessageCircle, Phone, Receipt, Sparkles, Trophy, Users, Zap } from 'lucide-react';
import { CRMNav } from '../crm/CRMNav';
import { CrmSyncToolbar } from '../crm/CrmSyncToolbar';

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
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const { data, loading, isValidating, error } = useDashboardStats(currentTenant?.id, endpoint);

  if (loading && !data) {
    return (
      <div className="space-y-4 ac-scroll-full ac-module-section">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} className="ac-metric-enter" style={{ animationDelay: `${i * 40}ms` } as React.CSSProperties} />
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

  const { actions } = resolveModuleActions(moduleId, user?.role ?? 'client');
  const workspaceAction = actions.find((a) => a.primary) ?? actions[0];
  const metrics = data.metrics.slice(0, 4);
  const allMetricsZero = metrics.every((m) => Number(m.value) === 0 || m.value === '0' || m.value === '0%');

  const overviewQuickModules =
    moduleId === 'overview'
      ? [
          { label: 'CRM', href: '/dashboard/crm', Icon: Users },
          { label: 'Deals', href: '/dashboard/deals', Icon: Zap },
          { label: 'Projects', href: '/dashboard/projects', Icon: Briefcase },
          { label: 'Tasks', href: '/dashboard/tasks', Icon: CheckSquare },
          { label: 'Invoicing', href: '/dashboard/accounting', Icon: FileText },
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
            label: 'What to do next',
            title: 'Run your first useful workflow',
            description: 'Start with CRM, billing, or messages so the workspace has enough activity to generate better advice.',
            href: workspaceAction?.resolvedHref || '/dashboard/crm',
            Icon: Users,
            cta: workspaceAction?.label || 'Open workspace',
          },
          {
            label: 'Bonnie help',
            title: 'Ask Bonnie for practical advice',
            description: 'Use Bonnie to summarise priorities, chase unpaid invoices, or suggest the next campaign to run.',
            href: '/dashboard/bonnie',
            Icon: Bot,
            cta: 'Open Bonnie',
          },
          {
            label: 'Gamification',
            title: 'Track streaks and progress',
            description: 'See momentum, activity goals, and streaks so the workspace feels alive instead of empty.',
            href: '/dashboard/gamification',
            Icon: Trophy,
            cta: 'View progress',
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
          {overviewNextSteps.map(({ label, title, description, href, Icon, cta }) => (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              className="ac-workspace-panel rounded-lg p-4 text-left transition-all hover:border-teal-500/20 hover:bg-slate-900/70"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-black uppercase tracking-widest text-teal-400">{label}</span>
              </div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-teal-400">
                {cta}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </button>
          ))}
        </div>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m, i) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            delta={m.delta}
            deltaDir={m.deltaDir}
            deltaColor={m.deltaColor}
            comparisonText={m.comparisonText}
            className="ac-metric-enter ac-metric-card"
            style={{ animationDelay: `${i * 45}ms` } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="ac-chart-enter">
        {chartType === 'line' ? (
          <DashboardLineChart
            data={data.mainChart}
            color={chartColor}
            valuePrefix={valuePrefix}
            title={chartTitle}
            subtitle={chartSubtitle}
          />
        ) : (
          <DashboardBarChart
            data={data.mainChart}
            color={chartColor}
            dual={dualBar}
            valuePrefix={valuePrefix}
            title={chartTitle}
            subtitle={chartSubtitle}
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
              className="text-[11px] text-teal-400 font-bold"
            >
              Manage
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {overviewQuickModules.map(({ label, href, Icon }) => (
              <button
                key={href}
                type="button"
                onClick={() => router.push(href)}
                className="h-10 rounded-lg bg-slate-950/40 border border-white/5 hover:border-white/10 transition-all flex items-center justify-center gap-2 min-w-0 px-2"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                aria-label={label}
              >
                <Icon className="w-4 h-4 shrink-0 text-teal-400" />
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
    <div className="space-y-4 ac-scroll-full ac-module-section">
      <CRMNav pathname="/dashboard/crm" />
      <CrmSyncToolbar />
      <ModuleDashboardView
        moduleId="crm"
        endpoint="/api/crm/stats"
        chartType="line"
        chartColor={DASHBOARD_COLORS.blue}
        chartTitle="Deals closed"
        chartSubtitle="Won by month"
      />
    </div>
  );
}

export function OutreachDashboard() {
  return (
    <ModuleDashboardView
      moduleId="outreach"
      endpoint="/api/outreach/stats"
      chartType="line"
      chartColor={DASHBOARD_COLORS.amber}
      chartTitle="Emails sent"
      chartSubtitle="Last 14 days"
    />
  );
}

export function InvoicingDashboard() {
  return (
    <ModuleDashboardView
      moduleId="invoicing"
      endpoint="/api/invoices/stats"
      chartType="bar"
      chartColor={DASHBOARD_COLORS.blue}
      dualBar
      valuePrefix="$"
      chartTitle="Invoiced vs collected"
      chartSubtitle="Monthly"
    />
  );
}

export function ContractsDashboard() {
  return (
    <ModuleDashboardView
      moduleId="contracts"
      endpoint="/api/contracts/stats"
      chartType="line"
      chartColor={DASHBOARD_COLORS.blue}
      chartTitle="Contracts signed"
      chartSubtitle="Per month"
    />
  );
}

export function ProjectsDashboard() {
  return (
    <ModuleDashboardView
      moduleId="projects"
      endpoint="/api/projects/stats"
      chartType="bar"
      chartColor={DASHBOARD_COLORS.amber}
      chartTitle="Tasks completed"
      chartSubtitle="Weekly"
    />
  );
}

export function SocialDashboard() {
  return (
    <ModuleDashboardView
      moduleId="social"
      endpoint="/api/social/stats"
      chartType="line"
      chartColor={DASHBOARD_COLORS.red}
      chartTitle="Posts published"
      chartSubtitle="Last 14 days"
    />
  );
}
