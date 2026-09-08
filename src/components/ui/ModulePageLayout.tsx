'use client';

import React, { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
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
  /** Let a dense module use its own pane-level scrolling instead of a second page scroller. */
  scrollContent?: boolean;
  /** Show a control that expands the module into a distraction-free working view. */
  allowFocus?: boolean;
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
  scrollContent = true,
  allowFocus = true,
}: ModulePageLayoutProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className={cn(
        'flex flex-1 flex-col gap-4 min-h-0 overflow-hidden relative',
        isFocused && 'fixed inset-0 z-[100] h-[100dvh] w-screen bg-[var(--ws-canvas,#0B1220)] p-3 md:p-4',
        phoneNavSafe && 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0',
        className,
      )}
    >
      {allowFocus ? (
        <button
          type="button"
          onClick={() => setIsFocused((current) => !current)}
          aria-pressed={isFocused}
          aria-label={isFocused ? 'Exit focus mode' : 'Focus this module'}
          title={isFocused ? 'Exit focus mode' : 'Focus this module'}
          className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-secondary,#0F172A)] text-[var(--ws-text-muted)] shadow-lg transition hover:text-[var(--ws-text-primary)]"
        >
          {isFocused ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      ) : null}
      {header ? <div className="flex-shrink-0">{header}</div> : null}
      {toolbar ? (
        <div className="sticky top-0 z-10 -mx-1 flex-shrink-0 bg-[var(--ws-canvas)]/95 px-1 py-1 backdrop-blur-sm">
          {toolbar}
        </div>
      ) : null}
      {stats ? <section className="flex-shrink-0">{stats}</section> : null}
      <section className={cn('flex-1 min-h-0', scrollContent && 'overflow-y-auto overscroll-contain')}>
        {children}
      </section>
    </div>
  );
}
