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
  Activity,
  MoreHorizontal,
  Plus,
  RefreshCw,
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
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/format/currency';
import { DashboardHomeLayoutToggle } from '@/components/dashboard/DashboardHomeLayoutToggle';
import { WORKSPACE } from '@/constants/design';

interface WorkspaceActivityItem {
  id: string;
  event_type: string;
  summary: string;
  actor_display_name: string | null;
  created_at: string;
}

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

function greetingForNow(name: string | null | undefined, t: (s: string) => string): string {
  const hour = new Date().getHours();
  const part = t(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');
  const short = (name || '').trim().split(/\s+/)[0];
  return short ? `${part}, ${short}` : part;
}

function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function AttentionFirstDashboard() {
  const { currentTenant, getDashboardStats } = useTenant();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { pendingCount } = useBonnieApprovals(currentTenant?.id);
  const { brief } = useBonnieMorningBrief(currentTenant?.id);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [bonnieActions, setBonnieActions] = useState<BonnieAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [bonnieLoading, setBonnieLoading] = useState(true);
  const [bonnieError, setBonnieError] = useState(false);
  const [workspaceActivity, setWorkspaceActivity] = useState<WorkspaceActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState(false);
  const [nbaItems, setNbaItems] = useState<AttentionItem[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!currentTenant?.id || !user?.id) return;
    setLoading(true);
    setStatsError(false);
    void getDashboardStats(currentTenant.id, user.id)
      .then((r) => {
        setStats((r.stats as Record<string, unknown>) ?? null);
        setStatsError(Boolean(r.error));
      })
      .catch(() => setStatsError(true))
      .finally(() => setLoading(false));
  }, [currentTenant?.id, user?.id, getDashboardStats, reloadKey]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    setBonnieLoading(true);
    setBonnieError(false);
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
      .catch(() => setBonnieError(true))
      .finally(() => setBonnieLoading(false));
  }, [currentTenant?.id, reloadKey]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    setActivityLoading(true);
    setActivityError(false);
    void fetch(`/api/dashboard/workspace-activity?tenantId=${currentTenant.id}&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        const items = (data?.activity || []) as WorkspaceActivityItem[];
        setWorkspaceActivity(items);
      })
      .catch(() => setActivityError(true))
      .finally(() => setActivityLoading(false));
  }, [currentTenant?.id, reloadKey]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    void fetch(`/api/dashboard/next-actions?tenantId=${currentTenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        const actions = Array.isArray(data?.actions) ? data.actions : [];
        setNbaItems(
          actions.slice(0, 8).map(
            (a: {
              object_id: string;
              object_type: string;
              recommended_next_action: string;
              reason?: string;
              href: string;
              urgency: string;
            }) => ({
              id: `nba-${a.object_type}-${a.object_id}`,
              label: a.recommended_next_action,
              detail: a.reason,
              href: a.href,
              severity:
                a.urgency === 'critical' || a.urgency === 'high'
                  ? 'high'
                  : a.urgency === 'medium'
                    ? 'medium'
                    : 'low',
              icon: Target,
            })
          )
        );
      })
      .catch(() => setNbaItems([]));
  }, [currentTenant?.id, reloadKey]);

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

  for (const item of nbaItems) {
    if (!attentionItems.some((existing) => existing.id === item.id)) {
      attentionItems.push(item);
    }
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

  const greeting = greetingForNow(user?.name || user?.email, t);

  return (
    <div className="space-y-4 ac-module-section ac-home-feed">
      {/* First viewport: greeting + money — one clean, compact composition */}
      <header className="ac-workspace-panel px-3 py-2.5 sm:px-3.5 sm:py-3 md:px-4 md:py-3.5">
        <div className="flex items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-[var(--ws-text-primary)]">
              {greeting}
            </h2>
            <p className="type-caption text-[var(--ws-text-secondary)] truncate">
              {currentTenant?.name ? currentTenant.name : t('Overview')}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <Link
              href="/dashboard/bonnie"
              className={cn(WORKSPACE.action.primary, 'inline-flex items-center justify-center gap-1.5 h-8.5 px-3 shrink-0 type-caption font-semibold')}
            >
              <Bot className="w-3.5 h-3.5" aria-hidden />
              {t('Ask Bonnie')}
            </Link>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:gap-2.5">
          <Link
            href="/dashboard/business/billing"
            className="rounded-lg border border-[var(--success-border)] bg-[var(--success-surface)] p-2 sm:p-2.5 transition-colors hover:border-[var(--success)]"
          >
            <p className="text-[11px] sm:type-caption font-semibold uppercase tracking-wider text-[var(--success-text)] flex items-center gap-1 truncate">
              <DollarSign className="w-3 h-3 text-[var(--success-text)] shrink-0" aria-hidden />
              <span>{t('Revenue')}</span>
            </p>
            {loading && !stats ? <div className="mt-1.5 h-6 w-20 rounded bg-[var(--ws-hover)] ac-skeleton-pulse" /> : statsError || !stats ? (
              <p className="mt-1 text-xs text-[var(--ws-text-secondary)]">{t('Unavailable')}</p>
            ) : (
              <p className="mt-1 text-base sm:text-lg md:text-xl font-bold tabular-nums tracking-tight text-[var(--success-text)] truncate">{formatCurrency(revenue)}</p>
            )}
          </Link>
          <Link
            href="/dashboard/business/billing/manage"
            className="rounded-lg border border-[var(--info-border)] bg-[var(--info-surface)] p-2 sm:p-2.5 transition-colors hover:border-[var(--info)]"
          >
            <p className="text-[11px] sm:type-caption font-semibold uppercase tracking-wider text-[var(--info-text)] flex items-center gap-1 truncate">
              <Receipt className="w-3 h-3 text-[var(--info-text)] shrink-0" aria-hidden />
              <span className="truncate">{t('Outstanding')}</span>
            </p>
            {loading && !stats ? <div className="mt-1.5 h-6 w-20 rounded bg-[var(--ws-hover)] ac-skeleton-pulse" /> : statsError || !stats ? (
              <p className="mt-1 text-xs text-[var(--ws-text-secondary)]">{t('Unavailable')}</p>
            ) : (
              <p className="mt-1 text-base sm:text-lg md:text-xl font-bold tabular-nums tracking-tight text-[var(--ws-text-primary)] truncate">{formatCurrency(outstanding)}</p>
            )}
          </Link>
        </div>
      </header>

      {/* Primary job: needs attention */}
      <section className="ac-workspace-panel p-3 md:p-3.5" aria-labelledby="home-attention-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3
            id="home-attention-heading"
            className={cn(WORKSPACE.typography.panelTitle, 'flex items-center gap-2')}
          >
            <AlertCircle className="w-4 h-4 text-[var(--warning-text)]" aria-hidden />
            {HUMAN_LABELS.needsAttention}
          </h3>
          {attentionItems.length > 0 ? (
            <span className="type-ui font-medium text-[var(--ws-text-tertiary)] tabular-nums">
              {Math.min(attentionItems.length, 6)} open
            </span>
          ) : null}
        </div>
        {loading && !stats ? (
          <div className="space-y-2" role="status" aria-label={t('Loading attention items')}>
            {[1, 2].map((item) => <div key={item} className="h-11 rounded bg-[var(--ws-hover)] ac-skeleton-pulse" />)}
          </div>
        ) : statsError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ws-radius-lg)] bg-[var(--ws-hover)] px-3 py-3">
            <p className="type-ui text-[var(--ws-text-secondary)]">{t('Some business totals could not be loaded.')}</p>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--ws-radius-lg)] px-3 type-button text-[var(--ac-accent)] hover:bg-[var(--ws-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac-accent)]"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              {t('Retry')}
            </button>
          </div>
        ) : attentionItems.length === 0 ? (
          <p className="type-card-description text-[var(--ws-text-secondary)] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--success-text)] shrink-0 mt-0.5" aria-hidden />
            {t('No items need your attention right now.')}
          </p>
        ) : (
          <div>
          <ul className="space-y-2">
            {attentionItems.slice(0, 4).map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-[var(--ws-radius-lg)] border transition-colors',
                    item.severity === 'high'
                      ? 'border-[var(--warning-border)] bg-[var(--warning-surface)] hover:border-[var(--warning)]'
                      : 'border-[var(--ws-border)] bg-[var(--ws-hover)] hover:border-[var(--ac-accent)]'
                  )}
                >
                  <item.icon className={cn('w-4 h-4 shrink-0', item.severity === 'high' ? 'text-[var(--warning-text)]' : 'text-[var(--ac-accent)]')} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="type-card-description font-medium text-[var(--ws-text-primary)]">
                      {item.label}
                    </p>
                    {item.detail ? (
                      <p className="type-card-description text-[var(--ws-text-tertiary)]">{item.detail}</p>
                    ) : null}
                    {item.severity === 'high' ? <span className="type-caption font-semibold text-[var(--warning-text)]">{t('Needs attention')}</span> : null}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--ws-text-tertiary)] shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          {attentionItems.length > 4 ? (
            <details className="mt-2 group">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[var(--ws-radius-lg)] px-2 type-ui font-medium text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac-accent)]">
                <MoreHorizontal className="h-4 w-4" aria-hidden />
                {t('Show remaining attention items')} ({attentionItems.length - 4})
              </summary>
              <ul className="mt-2 space-y-2">
                {attentionItems.slice(4).map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="flex min-h-11 items-center gap-3 rounded-[var(--ws-radius-lg)] bg-[var(--ws-hover)] px-3 py-2.5 type-ui text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)]">
                      <item.icon className="h-4 w-4 shrink-0 text-[var(--warning-text)]" aria-hidden />
                      <span className="min-w-0 flex-1 line-clamp-2">{item.label}</span>
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          </div>
        )}
      </section>

      {/* Secondary: Bonnie + activity side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-3.5">
        <section className="ac-workspace-panel p-3 md:p-3.5" aria-labelledby="home-bonnie-heading">
          <h3
            id="home-bonnie-heading"
            className={cn(WORKSPACE.typography.panelTitle, 'mb-2.5 flex items-center gap-2')}
          >
            <Bot className="w-4 h-4 text-[var(--ac-accent)]" aria-hidden />
            {HUMAN_LABELS.whatBonnieDid}
          </h3>
          {bonnieLoading ? (
            <div className="space-y-2" role="status" aria-label={t('Loading Bonnie activity')}>
              {[1, 2, 3].map((item) => <div key={item} className="h-5 rounded bg-[var(--ws-hover)] ac-skeleton-pulse" />)}
            </div>
          ) : bonnieError ? (
            <div className="flex items-center justify-between gap-3">
              <p className="type-ui text-[var(--ws-text-secondary)]">{t('Unable to load Bonnie activity.')}</p>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="min-h-11 px-2 type-button text-[var(--ac-accent)]">{t('Retry')}</button>
            </div>
          ) : bonnieActions.length === 0 ? (
            <p className="type-card-description text-[var(--ws-text-secondary)]">
              {t('Recent Bonnie actions will show here as your workspace gets active.')}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {bonnieActions.map((action) => (
                <li
                  key={action.id}
                  className="flex items-start gap-2 type-ui text-[var(--ws-text-secondary)]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ac-accent)] shrink-0 mt-0.5" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block line-clamp-2">{action.label}</span>
                    <time className="mt-0.5 block type-caption text-[var(--ws-text-tertiary)]">{relativeTime(action.timestamp)}</time>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/dashboard/bonnie"
            className="inline-flex mt-3 type-ui font-medium text-[var(--ac-accent)] hover:text-[var(--ac-accent-hover)]"
          >
            {t('Open Bonnie')}
          </Link>
        </section>

        <section className="ac-workspace-panel p-3 md:p-3.5" aria-labelledby="home-activity-heading">
          <h3
            id="home-activity-heading"
            className={cn(WORKSPACE.typography.panelTitle, 'mb-3 flex items-center gap-2')}
          >
            <Activity className="w-4 h-4 text-[var(--ac-accent)]" aria-hidden />
            {t('Recent activity')}
          </h3>
          {activityLoading ? (
            <div className="space-y-3" role="status" aria-label={t('Loading recent activity')}>
              {[1, 2, 3].map((item) => <div key={item} className="h-10 rounded bg-[var(--ws-hover)] ac-skeleton-pulse" />)}
            </div>
          ) : activityError ? (
            <div className="flex items-center justify-between gap-3">
              <p className="type-ui text-[var(--ws-text-secondary)]">{t('Unable to load recent activity.')}</p>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="min-h-11 px-2 type-button text-[var(--ac-accent)]">{t('Retry')}</button>
            </div>
          ) : workspaceActivity.length > 0 ? (
            <ol className="relative border-l border-[var(--ws-border)] ml-2 space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {workspaceActivity.slice(0, 5).map((item) => (
                <li key={item.id} className="ml-4 last:pb-0">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--ac-accent)] ring-4 ring-[var(--ws-panel)]" />
                  <div className="min-w-0">
                    <p className="type-card-description font-medium text-[var(--ws-text-primary)] line-clamp-2">
                      {item.summary}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {item.actor_display_name ? (
                        <span className="inline-flex items-center type-ui text-[var(--ws-text-tertiary)]">
                          {item.actor_display_name}
                        </span>
                      ) : null}
                      <time className="inline-block type-caption text-[var(--ws-text-tertiary)] tabular-nums">
                        {relativeTime(item.created_at)}
                      </time>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : recentActivity.length > 0 ? (
            <ul className="space-y-2.5">
              {recentActivity.map((item, i) => (
                <li
                  key={`${item.text}-${i}`}
                  className="flex items-start justify-between gap-3 type-ui"
                >
                  <span className="text-[var(--ws-text-secondary)] line-clamp-2">
                    {item.text || 'Update'}
                  </span>
                  {item.time ? (
                    <span className="type-ui text-[var(--ws-text-tertiary)] shrink-0 tabular-nums">
                      {item.time}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-card-description text-[var(--ws-text-secondary)]">
              {t('Invoices, deals, and messages will appear here as work moves forward.')}
            </p>
          )}
          <Link
            href="/dashboard/notifications"
            className="inline-flex mt-4 type-ui font-medium text-[var(--ac-accent)] hover:text-[var(--ac-accent-hover)]"
          >
            {t('View all activity')}
          </Link>
        </section>
      </div>

      {/* One primary shortcut; the wider module set remains available on demand. */}
      <nav aria-label={t('Quick actions')} className="flex flex-wrap items-start gap-2">
        <Link
          href="/dashboard/crm/workspace?quickAdd=true"
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--ws-radius-lg)] bg-[var(--ac-accent)] px-4 type-button text-[var(--ws-text-primary)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac-accent)] focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('Add customer')}
        </Link>
        <details className="group relative">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[var(--ws-radius-lg)] border border-[var(--ws-border)] bg-[var(--ws-panel)] px-3 type-button text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac-accent)]">
            <MoreHorizontal className="h-4 w-4" aria-hidden />
            {t('More actions')}
          </summary>
          <div className="mt-2 grid min-w-[220px] gap-1 rounded-[var(--ws-radius-lg)] border border-[var(--ws-border)] bg-[var(--ws-panel)] p-2 shadow-lg sm:absolute sm:left-0 sm:z-20">
          {[
          { label: 'Communication', href: '/dashboard/comms', icon: Mail },
          { label: 'Invoices', href: '/dashboard/business/billing/manage', icon: Receipt },
          { label: 'Schedule', href: '/dashboard/business/calendar', icon: Calendar },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex items-center gap-2 min-h-11 px-3 rounded-[var(--ws-radius-lg)] type-ui font-medium text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)] transition-colors"
          >
            <item.icon className="w-3.5 h-3.5 text-[var(--ac-accent)]" aria-hidden />
            {t(item.label)}
          </Link>
        ))}
          </div>
        </details>
        <div className="ml-auto hidden sm:block">
          <DashboardHomeLayoutToggle />
        </div>
      </nav>
    </div>
  );
}

export default AttentionFirstDashboard;
