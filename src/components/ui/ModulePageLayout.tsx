'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ModulePageLayoutProps {
  /** Sticky toolbar row (filters, view toggles, bulk actions) */
  toolbar?: React.ReactNode;
  /** Summary metric cards row */
  stats?: React.ReactNode;
  /** Optional workflow strip or breadcrumbs above toolbar */
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Standard list-module layout: optional header → toolbar → stats → scrollable data.
 * Use inside tabs that already receive a page title from the dashboard shell.
 */
export function ModulePageLayout({
  toolbar,
  stats,
  header,
  children,
  className,
}: ModulePageLayoutProps) {
  return (
    <div className={cn('flex flex-col ac-scroll-full min-h-0', className)}>
      {header ? <div className="flex-shrink-0">{header}</div> : null}
      {toolbar ? (
        <div className="flex-shrink-0 px-1 py-2 mb-2">{toolbar}</div>
      ) : null}
      {stats ? <section className="flex-shrink-0 mb-4 md:mb-6">{stats}</section> : null}
      <section className="flex-1 min-h-0 ac-scroll-full">{children}</section>
    </div>
  );
}
