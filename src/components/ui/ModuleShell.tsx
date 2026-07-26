'use client';

import React from 'react';
import { ENTERPRISE, WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

interface ModuleShellProps {
  title: string;
  description?: string;
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
 * Title scale matches WORKSPACE / PageHeader — not marketing display type.
 */
export function ModuleShell({
  title,
  description,
  search,
  actions,
  filters,
  summary,
  children,
  className,
}: ModuleShellProps) {
  return (
    <div className={cn('ac-scroll-full', className)}>
      <header
        className={cn(
          ENTERPRISE.moduleLayout.stickyHeader,
          'px-1 py-3 md:py-4 mb-4 md:mb-6',
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className={cn(WORKSPACE.typography.pageTitle, 'truncate')}>{title}</h1>
            {description ? (
              <p className={cn(WORKSPACE.typography.panelSubtitle, 'mt-0.5 line-clamp-2')}>
                {description}
              </p>
            ) : null}
          </div>
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
