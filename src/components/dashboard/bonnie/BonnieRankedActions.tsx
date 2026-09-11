'use client';

import Link from 'next/link';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildRankedRecommendations, type RankedRecommendation } from '@/lib/bonnie/rankedRecommendations';

interface BonnieRankedActionsProps {
  stats: Record<string, unknown> | null;
  pendingApprovals?: number;
  module?: string;
  className?: string;
  maxItems?: number;
}

function ActionRow({ item, featured }: { item: RankedRecommendation; featured?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        featured
          ? 'border-teal-500/40 bg-teal-500/10 dark:border-teal-500/30'
          : 'border-[var(--ws-border)] bg-[var(--ws-surface-secondary)]'
      )}
    >
      <p className="text-[12.5px] font-semibold text-[var(--ws-text-primary)] leading-snug">{item.title}</p>
      <p className="mt-0.5 text-[11px] text-[var(--ws-text-secondary)] leading-snug">{item.reason}</p>
      <Link
        href={item.href}
        className={cn(
          'inline-block mt-2 text-[11px] font-semibold',
          featured ? 'text-teal-700 hover:text-teal-600 dark:text-teal-300 dark:hover:text-teal-200' : 'text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300'
        )}
      >
        {item.actionLabel} →
      </Link>
    </div>
  );
}

/** Prioritized Bonnie recommendations from live workspace stats. */
export function BonnieRankedActions({
  stats,
  pendingApprovals,
  module,
  className,
  maxItems = 3,
}: BonnieRankedActionsProps) {
  const items = buildRankedRecommendations(stats, { pendingApprovals, module });
  if (items.length === 0) return null;

  const [primary, ...rest] = items.slice(0, maxItems);

  return (
    <div className={cn('ac-workspace-panel rounded-xl p-4 space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden />
        <h3 className="text-[13px] font-bold text-[var(--ws-text-primary)]">Bonnie recommends</h3>
      </div>
      <ActionRow item={primary} featured />
      {rest.length > 0 ? (
        <div className="space-y-2">
          {rest.map((item) => (
            <ActionRow key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
