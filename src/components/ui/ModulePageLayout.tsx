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
  /** Extra bottom padding so sticky phone CTAs clear the bottom nav */
  phoneNavSafe?: boolean;
}

/**
 * Standard list-module layout: optional header → toolbar → stats → scrollable data.
 * Use inside tabs that already receive a page title from the dashboard shell.
 * Phone-safe padding keeps content above the five-slot bottom nav.
 */
export function ModulePageLayout({
  toolbar,
  stats,
  header,
  children,
  className,
  phoneNavSafe = true,
}: ModulePageLayoutProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 ac-scroll-full min-h-0',
        phoneNavSafe && 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0',
        className,
      )}
    >
      {header ? <div className="flex-shrink-0">{header}</div> : null}
      {toolbar ? (
        <div className="flex-shrink-0">{toolbar}</div>
      ) : null}
      {stats ? <section className="flex-shrink-0">{stats}</section> : null}
      <section className="flex-1 min-h-0 ac-scroll-full">{children}</section>
    </div>
  );
}
