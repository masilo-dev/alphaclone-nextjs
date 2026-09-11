'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { WORKSPACE } from '@/constants/design';
import {
  buildContinuityHints,
  extractWorkspaceCounts,
  hasWorkspaceInvestment,
  type ContinuityHint,
} from '@/lib/behavioral/workspaceContinuity';

interface WorkspaceInvestmentSummaryProps {
  stats: Record<string, unknown> | null;
  loading?: boolean;
  className?: string;
}

function CountRow({ label, value }: { label: string; value: number }) {
  if (value <= 0) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-[12.5px]">
      <span className="text-[var(--ws-text-secondary)]">{label}</span>
      <span className="font-bold tabular-nums text-[var(--ws-text-primary)]">{value.toLocaleString()}</span>
    </div>
  );
}

function HintRow({ hint }: { hint: ContinuityHint }) {
  return (
    <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] px-3 py-2.5">
      <p className="text-[12px] text-[var(--ws-text-secondary)] leading-snug">{hint.message}</p>
      {hint.href && hint.actionLabel ? (
        <Link
          href={hint.href}
          className="inline-block mt-2 text-[11px] font-semibold text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
        >
          {hint.actionLabel} →
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Shows legitimate accumulated workspace value — not tenure days (ethical sunk-cost / investment).
 */
export function WorkspaceInvestmentSummary({
  stats,
  loading,
  className,
}: WorkspaceInvestmentSummaryProps) {
  const counts = extractWorkspaceCounts(stats);
  const hints = buildContinuityHints(stats);

  if (loading) {
    return (
      <div className={cn(WORKSPACE.panel.base, 'p-4 md:p-5 space-y-2', className)}>
        <div className="h-3 w-40 bg-[var(--ws-surface-tertiary)] rounded ac-skeleton-pulse" />
        <div className="h-3 w-full bg-[var(--ws-surface-tertiary)] rounded ac-skeleton-pulse" />
      </div>
    );
  }

  if (!hasWorkspaceInvestment(counts)) return null;

  return (
    <section className={cn(WORKSPACE.panel.base, 'p-4 md:p-5 space-y-3', className)} aria-label="Workspace value">
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ws-text-muted)]">
          Your workspace contains
        </p>
        <p className="text-[11px] text-[var(--ws-text-tertiary)] mt-0.5">
          Business intelligence you have built — export and ownership stay yours.
        </p>
      </div>

      <div className="space-y-2">
        <CountRow label="Contacts & clients" value={counts.contacts} />
        <CountRow label="Conversations" value={counts.conversations} />
        <CountRow label="Leads" value={counts.leads} />
        <CountRow label="Opportunities" value={counts.opportunities} />
        <CountRow label="Active projects" value={counts.projects} />
        <CountRow label="Invoice activity" value={counts.invoices} />
        <CountRow label="Live campaigns" value={counts.campaigns} />
      </div>

      {hints.length > 0 ? (
        <div className="space-y-2 pt-1 border-t border-[var(--ws-border)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ws-text-muted)]">Continue where you left off</p>
          {hints.map((hint) => (
            <HintRow key={hint.id} hint={hint} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
