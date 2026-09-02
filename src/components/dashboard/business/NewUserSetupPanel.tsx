'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, FileText, Linkedin, ChevronRight, X, CheckCircle2 } from 'lucide-react';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

const SETUP_STEPS = [
  {
    id: 'client',
    step: '1',
    title: 'Add your first client',
    description: 'Put a contact in CRM so deals, invoices, and mail have someone to attach to.',
    href: '/dashboard/crm/workspace?quickAdd=true',
    icon: UserPlus,
  },
  {
    id: 'invoice',
    step: '2',
    title: 'Send your first invoice',
    description: 'Create a bill in under a minute — templates and tracking are already set up.',
    href: '/dashboard/business/billing/manage?create=true',
    icon: FileText,
  },
  {
    id: 'connect',
    step: '3',
    title: 'Connect email or LinkedIn',
    description: 'Hook up inbox or social so outreach and replies stay in one workspace.',
    href: '/dashboard/mail',
    icon: Linkedin,
  },
] as const;

interface NewUserSetupPanelProps {
  user: User;
  onDismiss?: () => void;
  className?: string;
}

export function NewUserSetupPanel({ user, onDismiss, className }: NewUserSetupPanelProps) {
  const router = useRouter();
  const firstName = (user.name || user.email || 'there').split(' ')[0];

  return (
    <div
      className={cn(WORKSPACE.panel.base, 'p-4 md:p-5 border-[var(--ac-accent)]/25', className)}
      data-tour="business-setup-checklist"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ac-accent)]">
            Start here
          </p>
          <h2 className="text-[17px] font-semibold text-white tracking-tight mt-1">
            Welcome, {firstName} — do these 3 things first
          </h2>
          <p className="text-[13px] text-[var(--ws-text-secondary)] mt-1 max-w-xl">
            Most new workspaces are productive in under 10 minutes. Pick a step below — we will take you to the right screen.
          </p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-md text-[var(--ws-text-tertiary)] hover:text-white hover:bg-[var(--ws-hover)]"
            aria-label="Dismiss setup guide"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SETUP_STEPS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.href)}
              className="group text-left p-4 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] hover:border-[var(--ac-accent)]/40 hover:bg-[var(--ac-accent-muted)] transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ws-text-tertiary)]">
                  Step {item.step}
                </span>
                <Icon className="w-4 h-4 text-[var(--ac-accent)] ml-auto" />
              </div>
              <p className="text-[14px] font-semibold text-white group-hover:text-[var(--ac-accent-hover)]">
                {item.title}
              </p>
              <p className="text-[12px] text-[var(--ws-text-secondary)] mt-1 leading-relaxed">
                {item.description}
              </p>
              <span className="inline-flex items-center gap-1 mt-3 text-[11px] font-semibold text-[var(--ac-accent)]">
                Open
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-[var(--ws-border)]">
        <button
          type="button"
          onClick={() => router.push('/dashboard/help')}
          className="ac-workspace-action-btn text-[11px]"
        >
          Platform guide
        </button>
        <button
          type="button"
          onClick={() => router.push('/guide')}
          className="ac-workspace-action-btn text-[11px]"
        >
          Setup walkthrough
        </button>
        <span className="text-[11px] text-[var(--ws-text-tertiary)] inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Full access active
        </span>
      </div>
    </div>
  );
}

export function isSetupChecklistDismissed(userId: string): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(`setup_checklist_dismissed_${userId}`) === '1';
}

export function dismissSetupChecklist(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`setup_checklist_dismissed_${userId}`, '1');
}

export function isNewWorkspaceStats(stats: Record<string, unknown> | null | undefined): boolean {
  if (!stats) return false;
  const values = [
    stats.totalLeads,
    stats.clientCount,
    stats.activeProjects,
    stats.totalTasks,
    stats.unreadMessages,
    stats.activeCampaigns,
  ];
  return values.every((value) => Number(value || 0) === 0);
}
