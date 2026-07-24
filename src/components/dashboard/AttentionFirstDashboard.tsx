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
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBonnieApprovals } from '@/hooks/useBonnieApprovals';
import { useBonnieMorningBrief } from '@/hooks/useBonnieMorningBrief';
import { HUMAN_LABELS } from '@/lib/copy/humanLabels';
import { cn } from '@/lib/utils';

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

export function AttentionFirstDashboard() {
  const { currentTenant, getDashboardStats } = useTenant();
  const { user } = useAuth();
  const { pendingCount } = useBonnieApprovals(currentTenant?.id);
  const { brief } = useBonnieMorningBrief(currentTenant?.id);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [bonnieActions, setBonnieActions] = useState<BonnieAction[]>([]);

  useEffect(() => {
    if (!currentTenant?.id || !user?.id) return;
    void getDashboardStats(currentTenant.id, user.id).then((r) => {
      setStats((r.stats as Record<string, unknown>) ?? null);
    });
  }, [currentTenant?.id, user?.id, getDashboardStats]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    void fetch(`/api/bonnie/outcomes?tenantId=${currentTenant.id}&limit=5`)
      .then((r) => r.json())
      .then((data) => {
        const items = (data?.outcomes || data?.items || []) as Array<{ id: string; summary?: string; label?: string; created_at?: string }>;
        setBonnieActions(
          items.slice(0, 5).map((o) => ({
            id: o.id,
            label: o.summary || o.label || 'Completed a task',
            timestamp: o.created_at || new Date().toISOString(),
          }))
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

  (brief?.attentionItems || []).forEach((item, i) => {
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

  return (
    <div className="space-y-4 ac-module-section">
      {/* Needs Attention */}
      <section className="ac-workspace-panel p-4">
        <h2 className="text-[13px] font-semibold text-[var(--ws-text-primary)] mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" aria-hidden="true" />
          {HUMAN_LABELS.needsAttention}
        </h2>
        {attentionItems.length === 0 ? (
          <p className="text-[12px] text-[var(--ws-text-secondary)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            Nothing urgent right now — Bonnie is watching your business.
          </p>
        ) : (
          <ul className="space-y-2">
            {attentionItems.slice(0, 6).map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 p-2.5 rounded-lg border transition-colors hover:border-teal-500/30',
                    item.severity === 'high' ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/5 bg-white/[0.02]'
                  )}
                >
                  <item.icon className="w-4 h-4 text-teal-400 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[var(--ws-text-primary)]">{item.label}</p>
                    {item.detail ? (
                      <p className="text-[11px] text-[var(--ws-text-tertiary)]">{item.detail}</p>
                    ) : null}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--ws-text-tertiary)] shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* What Bonnie Did */}
      <section className="ac-workspace-panel p-4">
        <h2 className="text-[13px] font-semibold text-[var(--ws-text-primary)] mb-3 flex items-center gap-2">
          <Bot className="w-4 h-4 text-teal-400" aria-hidden="true" />
          {HUMAN_LABELS.whatBonnieDid}
        </h2>
        {bonnieActions.length === 0 ? (
          <p className="text-[12px] text-[var(--ws-text-secondary)]">
            Bonnie will show recent actions here as your workspace gets active.
          </p>
        ) : (
          <ul className="space-y-2">
            {bonnieActions.map((action) => (
              <li key={action.id} className="flex items-start gap-2 text-[12px] text-[var(--ws-text-secondary)]">
                <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{action.label}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/dashboard/bonnie" className="inline-block mt-3 text-[11px] text-teal-400 hover:text-teal-300">
          Open Bonnie →
        </Link>
      </section>

      {/* Recent business activity */}
      <section className="ac-workspace-panel p-4">
        <h2 className="text-[13px] font-semibold text-[var(--ws-text-primary)] mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" aria-hidden="true" />
          Recent activity
        </h2>
        {Array.isArray(stats?.recentActivity) && (stats.recentActivity as Array<{ text?: string; time?: string }>).length > 0 ? (
          <ul className="space-y-2">
            {(stats.recentActivity as Array<{ text?: string; time?: string }>).slice(0, 5).map((item, i) => (
              <li key={`${item.text}-${i}`} className="flex items-start justify-between gap-3 text-[12px]">
                <span className="text-[var(--ws-text-secondary)] line-clamp-2">{item.text || 'Update'}</span>
                {item.time ? (
                  <span className="text-[10px] text-[var(--ws-text-tertiary)] shrink-0">{item.time}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-[var(--ws-text-secondary)]">
            Wins and updates will show here as invoices, deals, and messages move forward.
          </p>
        )}
        <Link href="/dashboard/notifications" className="inline-block mt-3 text-[11px] text-teal-400 hover:text-teal-300">
          View all activity →
        </Link>
      </section>

      {/* Money Snapshot */}
      <section className="ac-workspace-panel p-4">
        <h2 className="text-[13px] font-semibold text-[var(--ws-text-primary)] mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          {HUMAN_LABELS.moneySnapshot}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
            <p className="text-[10px] uppercase tracking-wide text-[var(--ws-text-tertiary)]">Money coming in</p>
            <p className="text-lg font-semibold text-emerald-400 mt-1">
              ${revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <p className="text-[10px] uppercase tracking-wide text-[var(--ws-text-tertiary)]">Waiting to collect</p>
            <p className="text-lg font-semibold text-amber-400 mt-1">
              ${outstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/business/billing"
          className="inline-block mt-3 text-[11px] text-teal-400 hover:text-teal-300"
        >
          View money details →
        </Link>
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Customers', href: '/dashboard/crm/workspace', icon: Target },
          { label: 'Communication', href: '/dashboard/comms', icon: Mail },
          { label: 'Invoices', href: '/dashboard/business/billing/manage', icon: Receipt },
          { label: 'Schedule', href: '/dashboard/business/calendar', icon: Calendar },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="ac-workspace-panel p-3 flex flex-col items-center gap-1.5 hover:border-teal-500/30 transition-colors text-center"
          >
            <item.icon className="w-4 h-4 text-teal-400" aria-hidden="true" />
            <span className="text-[11px] font-medium text-[var(--ws-text-secondary)]">{item.label}</span>
          </Link>
        ))}
      </section>

      {/* Recent wins placeholder */}
      <section className="ac-workspace-panel p-4">
        <h2 className="text-[13px] font-semibold text-[var(--ws-text-primary)] mb-2 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" aria-hidden="true" />
          {HUMAN_LABELS.recentWins}
        </h2>
        <p className="text-[12px] text-[var(--ws-text-secondary)]">
          Wins like paid invoices, signed contracts, and booked meetings will appear here as your business grows.
        </p>
      </section>
    </div>
  );
}

export default AttentionFirstDashboard;
