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
        <div className="h-7 w-48 bg-slate-800 rounded-lg" />
        <div className="h-11 w-28 bg-slate-800 rounded-lg" />
      </div>

      {showStats && (
        <div className={ENTERPRISE.moduleLayout.summaryGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      )}

      <div className="ac-data-table border border-slate-800 rounded-lg overflow-hidden ac-skeleton-pulse">
        <div className="flex gap-4 px-3 py-3 border-b border-slate-800 bg-slate-900/80">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-800 rounded flex-1" />
          ))}
        </div>
        {Array.from({ length: safeRows }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-3 py-3 border-b border-slate-800/50 last:border-0 even:bg-slate-800/30"
          >
            <div className="h-4 w-8 bg-slate-800 rounded" />
            <div className="h-4 flex-1 bg-slate-800 rounded" />
            <div className="h-4 w-24 bg-slate-800 rounded" />
            <div className="h-4 w-20 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const DashboardShellSkeleton: React.FC = () => (
  <div className="flex h-screen bg-slate-950 overflow-hidden">
    <div className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-3 shrink-0 ac-skeleton-pulse">
      <div className="h-10 w-36 bg-slate-800 rounded-lg mb-4" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <div className="h-5 w-5 bg-slate-800 rounded" />
          <div className="h-4 flex-1 bg-slate-800 rounded" />
        </div>
      ))}
    </div>

    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-6 gap-4 shrink-0 ac-skeleton-pulse">
        <div className="h-5 w-5 bg-slate-800 rounded md:hidden" />
        <div className="flex-1 h-8 max-w-xs bg-slate-800 rounded-lg" />
        <div className="h-8 w-8 bg-slate-800 rounded-full ml-auto" />
      </div>
      <div className="flex-1 overflow-auto p-6">
        <TabSkeleton />
      </div>
    </div>
  </div>
);

export default TabSkeleton;
