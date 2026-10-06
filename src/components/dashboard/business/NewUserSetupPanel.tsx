'use client';

import React, { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { User } from '@/types';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

interface NewUserSetupPanelProps {
  user: User;
  tenantId: string;
  stats: Record<string, unknown> | null;
  onDismiss?: () => void;
  className?: string;
}

/** One passive checklist; observed completion is cached per user AND workspace. */
export function NewUserSetupPanel({ user, tenantId, stats, onDismiss, className }: NewUserSetupPanelProps) {
  const key = `alphaclone:setup:v1:${tenantId}:${user.id}`;
  const regionId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [tourActive, setTourActive] = useState(false);
  const { data: progress } = useQuery<Record<string, boolean | null>>({
    queryKey: ['onboarding-progress', tenantId, user.id],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/onboarding/progress`, { signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error('Getting started progress could not be loaded');
      return (await response.json()).progress;
    },
    staleTime: 60_000, retry: false,
  });
  const steps = [
    { id: 'profile', title: 'Complete business profile', href: '/dashboard/settings', done: progress?.profile === true || Boolean(user.company?.trim()) },
    { id: 'client', title: 'Add your first client', href: '/dashboard/crm/workspace?quickAdd=true', done: progress?.client === true || Number(stats?.clientCount) > 0 },
    { id: 'project', title: 'Create your first project', href: '/dashboard/business/projects/manage?create=true', done: progress?.project === true || Number(stats?.activeProjects) > 0 },
    { id: 'email', title: 'Connect email', href: '/dashboard/settings/integrations', done: progress?.email === true },
    { id: 'social', title: 'Connect a social account', href: '/dashboard/business/social', done: progress?.social === true },
    { id: 'execution', title: 'Perform your first AlphaClone execution', href: '/dashboard/bonnie', done: progress?.execution === true },
  ];
  const observed = steps.filter(step => step.done).map(step => step.id).join(',');
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
      const previous = Array.isArray(saved.completed) ? saved.completed.filter((id: unknown) => typeof id === 'string') : [];
      const next = [...new Set<string>([...previous, ...observed.split(',').filter(Boolean)])];
      setCompleted(next);
      setCollapsed(saved.collapsed === true);
      localStorage.setItem(key, JSON.stringify({ completed: next, collapsed: saved.collapsed === true }));
    } catch { /* Checklist remains usable when browser storage is unavailable. */ }
  }, [key, observed]);
  useEffect(() => {
    const sync = () => setTourActive(document.documentElement.dataset.productTourActive === 'true');
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-product-tour-active'] });
    sync();
    return () => observer.disconnect();
  }, []);
  if (tourActive || completed.length === steps.length) return null;
  return (
    <section className={cn('rounded-[var(--ws-radius-lg)] border border-[var(--ws-border)] bg-[var(--ws-panel)] p-3', className)} data-tour="business-setup-checklist" aria-label="Getting started">
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-expanded={!collapsed} aria-controls={regionId} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--ws-text-primary)]" onClick={() => {
          const next = !collapsed;
          setCollapsed(next);
          try { localStorage.setItem(key, JSON.stringify({ completed, collapsed: next })); } catch { /* Optional cache. */ }
        }}>
          Getting started <span className="text-xs font-normal text-[var(--ws-text-secondary)]">{completed.length}/{steps.length}</span>
          {collapsed ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronUp className="h-4 w-4" aria-hidden />}
        </button>
        {onDismiss ? <button type="button" onClick={onDismiss} aria-label="Dismiss getting started" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)]"><X className="h-4 w-4" aria-hidden /></button> : null}
      </div>
      {!collapsed ? <ul id={regionId} className="divide-y divide-[var(--ws-border)]">
        {steps.map(step => completed.includes(step.id) ? null : <li key={step.id}>
          <Link href={step.href} className="flex min-h-11 items-center gap-2 rounded-md py-2 text-sm text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)]"><CheckCircle2 className="h-4 w-4 text-[var(--ws-text-tertiary)]" aria-hidden />{step.title}</Link>
        </li>)}
      </ul> : null}
    </section>
  );
}

export function isSetupChecklistDismissed(userId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(`setup_checklist_dismissed_${userId}`) === '1' ||
      localStorage.getItem(`onboarding_goal_dismissed_${userId}`) === 'true';
  } catch { return true; }
}
export function dismissSetupChecklist(userId: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`setup_checklist_dismissed_${userId}`, '1'); } catch { /* Optional cache. */ }
}
