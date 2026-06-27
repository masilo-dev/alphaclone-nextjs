'use client';

import React from 'react';
import { ENTERPRISE } from '@/constants/design';
import { cn } from '@/lib/utils';

interface ModuleShellProps {
  title: string;
  /** Search input or combobox */
  search?: React.ReactNode;
  /** Primary module action (e.g. Create) */
  actions?: React.ReactNode;
  /** Filter/sort chips — horizontal scroll on mobile */
  filters?: React.ReactNode;
  /** Summary metric cards row */
  summary?: React.ReactNode;
  /** Main data grid or list — must scroll fully, no max-height clipping */
  children: React.ReactNode;
  className?: string;
}

/**
 * Standard module layout: sticky header → summary cards → scrollable data.
 * Uses AlphaClone brand; follows enterprise structural patterns.
 */
export function ModuleShell({
  title,
  search,
  actions,
  filters,
  summary,
  children,
  className,
}: ModuleShellProps) {
  return (
    <div className={cn('ac-scroll-full', className)}>
      <header className={cn(ENTERPRISE.moduleLayout.stickyHeader, 'px-1 py-3 md:py-4 mb-4 md:mb-6')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl md:text-[32px] font-bold text-white tracking-tight">{title}</h1>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
            {search ? <div className="flex-1 sm:max-w-xs">{search}</div> : null}
            {actions ? <div className="flex gap-2 shrink-0">{actions}</div> : null}
          </div>
        </div>
        {filters ? (
          <div className="mt-3 -mx-1 overflow-x-auto ios-scroll">
            <div className="flex gap-2 px-1 pb-1 min-w-min">{filters}</div>
          </div>
        ) : null}
      </header>

      {summary ? (
        <section className={cn(ENTERPRISE.moduleLayout.summaryGrid, 'mb-4 md:mb-6')}>
          {summary}
        </section>
      ) : null}

      <section className="ac-scroll-full">{children}</section>
    </div>
  );
}
