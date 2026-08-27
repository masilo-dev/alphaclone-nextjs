'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Mail,
  Receipt,
  Target,
  Trophy,
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBonnieApprovals } from '@/hooks/useBonnieApprovals';
import { useBonnieMorningBrief } from '@/hooks/useBonnieMorningBrief';
import { HUMAN_LABELS } from '@/lib/copy/humanLabels';
import {
  businessOutcomeSummary,
  isTechnicalJargonText,
} from '@/lib/copy/businessFriendlyErrors';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format/currency';
import { DashboardHomeLayoutToggle } from '@/components/dashboard/DashboardHomeLayoutToggle';
import { WORKSPACE } from '@/constants/design';

interface AttentionItem {
  id: string;
  label: string;
  detail?: string;
  href: string;
  severity: 'high' | 'medium' | 'low';
  icon: React.ElementType;
}

interface BonnieAction {
  id: string;
  label: string;
  timestamp: string;
}

function greetingForNow(name?: string | null): string {
  const hour = new Date().getHours();
  const part =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const short = (name || '').trim().split(/\s+/)[0];
  return short ? `${part}, ${short}` : part;
}

export function AttentionFirstDashboard() {
  const { currentTenant, getDashboardStats } = useTenant();
  const { user } = useAuth();
  const { pendingCount } = useBonnieApprovals(currentTenant?.id);
  const { brief } = useBonnieMorningBrief(currentTenant?.id);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [bonnieActions, setBonnieActions] = useState<BonnieAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentTenant?.id || !user?.id) return;
    setLoading(true);
    void getDashboardStats(currentTenant.id, user.id)
      .then((r) => {
        setStats((r.stats as Record<string, unknown>) ?? null);
      })
      .finally(() => setLoading(false));
  }, [currentTenant?.id, user?.id, getDashboardStats]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    void fetch(`/api/bonnie/outcomes?tenantId=${currentTenant.id}&limit=5`)
      .then((r) => r.json())
      .then((data) => {
        const items = (data?.outcomes || data?.items || []) as Array<{
          id: string;
          summary?: string;
          label?: string;
          created_at?: string;
          success?: boolean;
          tool_name?: string;
        }>;
        setBonnieActions(
          items
            .slice(0, 5)
            .map((o) => {
              const raw = o.summary || o.label || '';
              const label = isTechnicalJargonText(raw)
                ? businessOutcomeSummary({
                    tool: o.tool_name || 'define_outcome',
                    success: o.success,
                    errorMessage: raw,
                  })
                : raw || 'Completed a workspace action';
              return {
                id: o.id,
                label,
                timestamp: o.created_at || new Date().toISOString(),
              };
            })
            .filter((o) => !isTechnicalJargonText(o.label))
        );
      })
      .catch(() => {});
  }, [currentTenant?.id]);

  const attentionItems: AttentionItem[] = [];

  if (pendingCount > 0) {
    attentionItems.push({
      id: 'approvals',
      label: `${pendingCount} item${pendingCount > 1 ? 's' : ''} waiting for your OK`,
      href: '/dashboard/bonnie/approvals',
      severity: 'high',
      icon: AlertCircle,
    });
  }

  const overdueInvoices = Number(stats?.overdueInvoices ?? stats?.overdue_invoices ?? 0);
  if (overdueInvoices > 0) {
    attentionItems.push({
      id: 'overdue',
      label: HUMAN_LABELS.overdueAR,
      detail: `${overdueInvoices} invoice${overdueInvoices > 1 ? 's' : ''} overdue`,
      href: '/dashboard/business/billing/manage',
      severity: 'high',
      icon: Receipt,
    });
  }

  const openTasks = Number(stats?.openTasks ?? stats?.open_tasks ?? 0);
  if (openTasks > 0) {
    attentionItems.push({
      id: 'tasks',
      label: HUMAN_LABELS.taskBacklog,
      detail: `${openTasks} open`,
      href: '/dashboard/tasks',
      severity: 'medium',
      icon: Target,
    });
  }

  (Array.isArray(brief?.attentionItems) ? brief.attentionItems : []).forEach((item, i) => {
    attentionItems.push({
      id: `brief-${i}`,
      label: item,
      href: '/dashboard/bonnie',
      severity: 'medium',
      icon: Bot,
    });
  });

  const revenue = Number(stats?.revenue ?? stats?.totalRevenue ?? 0);
  const outstanding = Number(stats?.outstanding ?? stats?.outstandingInvoices ?? 0);
  const recentActivity = Array.isArray(stats?.recentActivity)
    ? (stats.recentActivity as Array<{ text?: string; time?: string }>).slice(0, 5)
    : [];

  const greeting = greetingForNow(user?.name || user?.email);

  if (loading && !stats) {
    return (
      <div className="space-y-4 ac-module-section" role="status" aria-busy="true" aria-label="Loading home">
        <div className="ac-workspace-panel p-5 ac-skeleton-pulse min-h-[88px]">
          <div className="h-4 w-40 bg-[var(--ws-hover)] rounded" />
          <div className="h-3 w-56 bg-[var(--ws-hover)] rounded mt-3" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="ac-workspace-panel p-4 ac-skeleton-pulse min-h-[84px]" />
          ))}
        </div>
        <div className="ac-workspace-panel p-4 ac-skeleton-pulse min-h-[120px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 ac-module-section ac-home-feed">
      {/* First viewport: greeting + money — one clear composition */}
      <header className="ac-workspace-panel px-4 py-4 md:px-5 md:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className={WORKSPACE.typography.sectionLabel}>Home</p>
            <h2 className="mt-1 text-[1.25rem] md:text-[1.375rem] font-semibold tracking-tight text-[var(--ws-text-primary,#fff)]">
              {greeting}
            </h2>
            <p className="mt-1 text-[13px] text-[var(--ws-text-secondary)] line-clamp-2">
              {currentTenant?.name
                ? `${currentTenant.name} — focus on what needs you, then let Bonnie handle the rest.`
                : 'Focus on what needs you, then let Bonnie handle the rest.'}
            </p>
          </div>
          <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
            <DashboardHomeLayoutToggle />
            <Link
              href="/dashboard/bonnie"
              className={cn(WORKSPACE.action.primary, 'inline-flex items-center justify-center gap-2 min-h-11 px-4 shrink-0')}
            >
              <Bot className="w-4 h-4" aria-hidden />
              Ask Bonnie
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/business/billing"
            className="rounded-[var(--ws-radius-lg)] border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-3 transition-colors hover:border-emerald-500/35"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--ws-text-tertiary)] flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" aria-hidden />
              Money in
            </p>
            <p className="mt-1.5 text-[1.375rem] font-semibold tabular-nums tracking-tight text-emerald-400">
              {formatCurrency(revenue)}
            </p>
          </Link>
          <Link
            href="/dashboard/business/billing/manage"
            className="rounded-[var(--ws-radius-lg)] border border-amber-500/20 bg-amber-500/[0.06] px-3 py-3 transition-colors hover:border-amber-500/35"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--ws-text-tertiary)] flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-amber-400" aria-hidden />
              To collect
            </p>
            <p className="mt-1.5 text-[1.375rem] font-semibold tabular-nums tracking-tight text-amber-400">
              {formatCurrency(outstanding)}
            </p>
          </Link>
        </div>
      </header>

      {/* Primary job: needs attention */}
      <section className="ac-workspace-panel p-4 md:p-5" aria-labelledby="home-attention-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3
            id="home-attention-heading"
            className={cn(WORKSPACE.typography.panelTitle, 'flex items-center gap-2')}
          >
            <AlertCircle className="w-4 h-4 text-amber-400" aria-hidden />
            {HUMAN_LABELS.needsAttention}
          </h3>
          {attentionItems.length > 0 ? (
            <span className="text-[11px] font-medium text-[var(--ws-text-tertiary)] tabular-nums">
              {Math.min(attentionItems.length, 6)} open
            </span>
          ) : null}
        </div>
        {attentionItems.length === 0 ? (
          <p className="text-[13px] text-[var(--ws-text-secondary)] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
            Nothing urgent right now — Bonnie is watching your business.
          </p>
        ) : (
          <ul className="space-y-2">
            {attentionItems.slice(0, 6).map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-[var(--ws-radius-lg)] border transition-colors',
                    item.severity === 'high'
                      ? 'border-amber-500/25 bg-amber-500/[0.06] hover:border-amber-500/40'
                      : 'border-[var(--ws-border)] bg-[var(--ws-hover)] hover:border-teal-500/30'
                  )}
                >
                  <item.icon className="w-4 h-4 text-teal-400 shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--ws-text-primary,#fff)]">
                      {item.label}
                    </p>
                    {item.detail ? (
                      <p className="text-[12px] text-[var(--ws-text-tertiary)]">{item.detail}</p>
                    ) : null}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--ws-text-tertiary)] shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Secondary: Bonnie + activity side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="ac-workspace-panel p-4 md:p-5" aria-labelledby="home-bonnie-heading">
          <h3
            id="home-bonnie-heading"
            className={cn(WORKSPACE.typography.panelTitle, 'mb-3 flex items-center gap-2')}
          >
            <Bot className="w-4 h-4 text-teal-400" aria-hidden />
            {HUMAN_LABELS.whatBonnieDid}
          </h3>
          {bonnieActions.length === 0 ? (
            <p className="text-[13px] text-[var(--ws-text-secondary)]">
              Recent Bonnie actions will show here as your workspace gets active.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {bonnieActions.map((action) => (
                <li
                  key={action.id}
                  className="flex items-start gap-2 text-[13px] text-[var(--ws-text-secondary)]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" aria-hidden />
                  <span className="line-clamp-2">{action.label}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/dashboard/bonnie"
            className="inline-flex mt-4 text-[12px] font-medium text-teal-400 hover:text-teal-300"
          >
            Open Bonnie
          </Link>
        </section>

        <section className="ac-workspace-panel p-4 md:p-5" aria-labelledby="home-activity-heading">
          <h3
            id="home-activity-heading"
            className={cn(WORKSPACE.typography.panelTitle, 'mb-3 flex items-center gap-2')}
          >
            <Trophy className="w-4 h-4 text-amber-400" aria-hidden />
            Recent activity
          </h3>
          {recentActivity.length > 0 ? (
            <ul className="space-y-2.5">
              {recentActivity.map((item, i) => (
                <li
                  key={`${item.text}-${i}`}
                  className="flex items-start justify-between gap-3 text-[13px]"
                >
                  <span className="text-[var(--ws-text-secondary)] line-clamp-2">
                    {item.text || 'Update'}
                  </span>
                  {item.time ? (
                    <span className="text-[11px] text-[var(--ws-text-tertiary)] shrink-0 tabular-nums">
                      {item.time}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[var(--ws-text-secondary)]">
              Invoices, deals, and messages will appear here as work moves forward.
            </p>
          )}
          <Link
            href="/dashboard/notifications"
            className="inline-flex mt-4 text-[12px] font-medium text-teal-400 hover:text-teal-300"
          >
            View all activity
          </Link>
        </section>
      </div>

      {/* Compact jump row — not a card grid of equal panels */}
      <nav aria-label="Quick links" className="flex flex-wrap gap-2">
        {[
          { label: 'Customers', href: '/dashboard/crm/workspace', icon: Target },
          { label: 'Communication', href: '/dashboard/comms', icon: Mail },
          { label: 'Invoices', href: '/dashboard/business/billing/manage', icon: Receipt },
          { label: 'Schedule', href: '/dashboard/business/calendar', icon: Calendar },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex items-center gap-2 min-h-11 px-3 rounded-[var(--ws-radius-lg)] border border-[var(--ws-border)] bg-[var(--ws-panel)] text-[12px] font-medium text-[var(--ws-text-secondary)] hover:border-teal-500/35 hover:text-[var(--ws-text-primary,#fff)] transition-colors"
          >
            <item.icon className="w-3.5 h-3.5 text-teal-400" aria-hidden />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default AttentionFirstDashboard;
