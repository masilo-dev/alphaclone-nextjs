'use client';

import React, { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WORKSPACE_FOCUS } from '@/constants/design';

export interface WorkspaceToolbarProps {
  /** Search string value */
  search?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  /** Primary filter controls (Status dropdown, etc.) */
  filters?: React.ReactNode;
  /** Secondary filter controls that collapse into drawer/popover on mobile */
  secondaryFilters?: React.ReactNode;
  /** View mode toggle buttons (e.g. Table vs Board vs List) */
  viewMode?: React.ReactNode;
  /** More action menu (Export, Bulk actions, etc.) */
  moreMenu?: React.ReactNode;
  className?: string;
  density?: 'compact' | 'comfortable';
}

/**
 * Universal Workspace Toolbar.
 * Standardizes search, filter dropdowns, view mode selectors, and more actions.
 * Ultra-compact 32px height with charcoal design system tokens.
 */
export function WorkspaceToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  secondaryFilters,
  viewMode,
  moreMenu,
  className,
  density = 'compact',
}: WorkspaceToolbarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const densityStyles = WORKSPACE_FOCUS.density[density];

  return (
    <div
      className={cn(
        'w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 py-1 px-2.5 bg-[var(--surface-1)] border-b border-[var(--border-subtle)] shrink-0',
        densityStyles.toolbar,
        className
      )}
    >
      {/* Left: Search input + Primary filters */}
      <div className="flex flex-1 flex-wrap items-center gap-1.5 min-w-0">
        {onSearchChange ? (
          <div className="relative flex-1 min-w-[130px] sm:max-w-xs">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-7.5 pl-8 pr-6 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            ) : null}
          </div>
        ) : null}

        {filters ? (
          <div className="flex items-center gap-1 flex-wrap">{filters}</div>
        ) : null}

        {secondaryFilters ? (
          <div className="hidden md:flex items-center gap-1 flex-wrap">
            {secondaryFilters}
          </div>
        ) : null}

        {secondaryFilters ? (
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            aria-expanded={mobileFiltersOpen}
            className="md:hidden inline-flex items-center gap-1 h-7.5 px-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Filter className="w-3 h-3" aria-hidden="true" />
            <span>Filters</span>
          </button>
        ) : null}
      </div>

      {/* Right: View mode toggle + More menu */}
      {(viewMode || moreMenu) ? (
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
          {viewMode ? <div className="flex items-center">{viewMode}</div> : null}
          {moreMenu ? <div className="flex items-center">{moreMenu}</div> : null}
        </div>
      ) : null}

      {/* Mobile secondary filters drawer */}
      {mobileFiltersOpen && secondaryFilters ? (
        <div className="md:hidden w-full pt-1.5 mt-1 border-t border-[var(--border-subtle)] flex flex-wrap gap-1.5 animate-fade-in">
          {secondaryFilters}
        </div>
      ) : null}
    </div>
  );
}

export default WorkspaceToolbar;
