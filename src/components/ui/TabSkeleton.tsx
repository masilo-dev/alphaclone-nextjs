'use client';

import React from 'react';
import { MetricCardSkeleton } from '@/components/dashboard/MetricCard';
import { ENTERPRISE } from '@/constants/design';

/**
 * Generic animated skeleton for lazy-loaded dashboard tabs.
 */
export const TabSkeleton: React.FC<{ rows?: number; showStats?: boolean }> = ({
  rows = 6,
  showStats = true,
}) => {
  const safeRows = Math.max(1, Number(rows) || 6);

  return (
    <div className={`${ENTERPRISE.moduleLayout.sectionGap} p-1`}>
      <div className="flex items-center justify-between ac-skeleton-pulse">
        <div className="h-7 w-48 bg-[var(--ws-surface-secondary)] rounded-lg" />
        <div className="h-11 w-28 bg-[var(--ws-surface-secondary)] rounded-lg" />
      </div>

      {showStats && (
        <div className={ENTERPRISE.moduleLayout.summaryGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      )}

      <div className="ac-data-table border border-[var(--ws-border)] rounded-lg overflow-hidden ac-skeleton-pulse">
        <div className="flex gap-4 px-3 py-3 border-b border-[var(--ws-border)] bg-[var(--ws-panel)]/80">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 bg-[var(--ws-surface-secondary)] rounded flex-1" />
          ))}
        </div>
        {Array.from({ length: safeRows }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-3 py-3 border-b border-[var(--ws-border)]/50 last:border-0 even:bg-[var(--ws-surface-secondary)]/30"
          >
            <div className="h-4 w-8 bg-[var(--ws-surface-secondary)] rounded" />
            <div className="h-4 flex-1 bg-[var(--ws-surface-secondary)] rounded" />
            <div className="h-4 w-24 bg-[var(--ws-surface-secondary)] rounded" />
            <div className="h-4 w-20 bg-[var(--ws-surface-secondary)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const DashboardShellSkeleton: React.FC = () => (
    <div className="flex min-h-screen bg-[var(--ws-canvas)] overflow-hidden" role="status" aria-label="Loading workspace">
    <div className="hidden md:flex flex-col w-64 bg-[var(--ws-panel)] border-r border-[var(--ws-border)] p-4 space-y-3 shrink-0 ac-skeleton-pulse">
      <div className="h-10 w-36 bg-[var(--ws-surface-secondary)] rounded-lg mb-4" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <div className="h-5 w-5 bg-[var(--ws-surface-secondary)] rounded" />
          <div className="h-4 flex-1 bg-[var(--ws-surface-secondary)] rounded" />
        </div>
      ))}
    </div>

    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-14 bg-[var(--ws-panel)] border-b border-[var(--ws-border)] flex items-center px-3 sm:px-6 gap-3 sm:gap-4 shrink-0 ac-skeleton-pulse">
        <div className="h-5 w-5 bg-[var(--ws-surface-secondary)] rounded md:hidden" />
        <div className="flex-1 h-8 max-w-xs bg-[var(--ws-surface-secondary)] rounded-lg" />
        <div className="h-8 w-8 bg-[var(--ws-surface-secondary)] rounded-full ml-auto" />
      </div>
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <TabSkeleton />
      </div>
    </div>
  </div>
);

export default TabSkeleton;
