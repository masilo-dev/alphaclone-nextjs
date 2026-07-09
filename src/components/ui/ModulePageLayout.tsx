'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const BonnieModuleDock = dynamic(
  () => import('@/components/dashboard/bonnie/BonnieModuleDock'),
  { ssr: false, loading: () => <div className="h-full min-h-[200px] rounded-xl border border-slate-800 bg-slate-950/50" /> }
);

interface ModulePageLayoutProps {
  /** Sticky toolbar row (filters, view toggles, bulk actions) */
  toolbar?: React.ReactNode;
  /** Summary metric cards row */
  stats?: React.ReactNode;
  /** Optional workflow strip or breadcrumbs above toolbar */
  header?: React.ReactNode;
  /** Optional Bonnie AI side panel (desktop dock) */
  bonnieSlot?: React.ReactNode;
  /** Show default Bonnie module dock on desktop (lg+) */
  showBonnieDock?: boolean;
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
  bonnieSlot,
  showBonnieDock = false,
  children,
  className,
}: ModulePageLayoutProps) {
  const sidePanel = bonnieSlot ?? (showBonnieDock ? <BonnieModuleDock /> : null);

  if (sidePanel) {
    return (
      <div className={cn('flex flex-col lg:flex-row gap-4 ac-scroll-full min-h-0', className)}>
        <div className="flex flex-col flex-1 min-w-0 min-h-0 ac-scroll-full">
          {header ? <div className="flex-shrink-0">{header}</div> : null}
          {toolbar ? (
            <div className="flex-shrink-0 px-1 py-2 mb-2">{toolbar}</div>
          ) : null}
          {stats ? <section className="flex-shrink-0 mb-4 md:mb-6">{stats}</section> : null}
          <section className="flex-1 min-h-0 ac-scroll-full">{children}</section>
        </div>
        <aside className="hidden lg:flex lg:w-[320px] xl:w-[360px] flex-shrink-0 flex-col min-h-0">
          {sidePanel}
        </aside>
      </div>
    );
  }

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
