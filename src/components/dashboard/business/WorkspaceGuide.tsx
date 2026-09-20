'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, BriefcaseBusiness, CircleDollarSign, Mail, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

const AREAS = [
  { title: 'Sales & CRM', description: 'Store leads, contacts, conversations, and deal progress in one record.', action: 'Open CRM', href: '/dashboard/crm/workspace', icon: Users, color: 'text-blue-300' },
  { title: 'Projects', description: 'Turn approved work into stages, tasks, files, deadlines, and client updates.', action: 'Open Projects', href: '/dashboard/business/projects', icon: BriefcaseBusiness, color: 'text-violet-300' },
  { title: 'Marketing', description: 'Prepare email and social campaigns, review them, and track delivery results.', action: 'Open Marketing', href: '/dashboard/business/campaigns', icon: Mail, color: 'text-cyan-300' },
  { title: 'Money', description: 'Create contracts, invoices, payment links, expenses, and financial reports.', action: 'Open Money', href: '/dashboard/business/billing/manage', icon: CircleDollarSign, color: 'text-emerald-300' },
  { title: 'Bonnie', description: 'Ask for a business outcome. Bonnie prepares steps for review before external actions run.', action: 'Open Bonnie', href: '/dashboard/business/bonnie', icon: Bot, color: 'text-amber-300' },
] as const;

interface WorkspaceGuideProps {
  user: User;
}

export function WorkspaceGuide({ user }: WorkspaceGuideProps) {
  const router = useRouter();
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(`workspace_guide_seen_${user.id}`) !== 'true';
  });

  const closeGuide = () => {
    localStorage.setItem(`workspace_guide_seen_${user.id}`, 'true');
    setOpen(false);
  };

  return (
    <section className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/80 p-4 shadow-sm md:p-5" aria-labelledby="workspace-guide-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ac-accent)]">Workspace map</p>
          <h2 id="workspace-guide-title" className="mt-1 text-base font-semibold tracking-tight text-[var(--ws-text-primary)]">Know where each kind of work belongs</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--ws-text-secondary)]">You can start with any area. Each one keeps the next step connected instead of making you jump between separate systems.</p>
        </div>
        {open ? (
          <button type="button" onClick={closeGuide} className="min-h-10 min-w-10 rounded-lg p-2 text-[var(--ws-text-tertiary)] hover:bg-[var(--ws-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac-accent)]" aria-label="Hide workspace map">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="min-h-10 rounded-lg border border-[var(--ws-border)] px-3 text-xs font-semibold text-[var(--ac-accent)] hover:bg-[var(--ws-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac-accent)]">
            Show guide
          </button>
        )}
      </div>

      {open ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {AREAS.map((area) => {
            const Icon = area.icon;
            return (
              <button key={area.title} type="button" onClick={() => router.push(area.href)} className="group flex min-h-[150px] flex-col rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface)] p-3 text-left transition-colors hover:border-[var(--ac-accent)]/50 hover:bg-[var(--ws-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac-accent)]">
                <Icon className={cn('h-5 w-5', area.color)} aria-hidden="true" />
                <span className="mt-3 text-sm font-semibold text-[var(--ws-text-primary)]">{area.title}</span>
                <span className="mt-1 text-[11px] leading-4 text-[var(--ws-text-secondary)]">{area.description}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[11px] font-semibold text-[var(--ac-accent)]">{area.action}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default WorkspaceGuide;
