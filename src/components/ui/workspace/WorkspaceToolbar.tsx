'use client';

import React, { useState } from 'react';
import { Search, Filter, X, MoreHorizontal } from 'lucide-react';
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
 * Automatically collapses extra filters on mobile to protect vertical screen real estate.
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
  density = 'comfortable',
}: WorkspaceToolbarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const densityStyles = WORKSPACE_FOCUS.density[density];

  return (
    <div
      className={cn(
        'w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 py-2 px-3 sm:px-4 bg-[var(--ws-surface)] border-b border-[var(--ws-border)]',
        densityStyles.toolbar,
        className
      )}
    >
      {/* Left: Search input + Primary filters */}
      <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
        {onSearchChange ? (
          <div className="relative flex-1 min-w-[160px] sm:max-w-xs">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ws-text-muted)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] text-sm text-[var(--ws-text-primary)] placeholder-[var(--ws-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-blue-500)] focus:border-[var(--brand-blue-500)]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}

        {filters ? (
          <div className="flex items-center gap-1.5 flex-wrap">{filters}</div>
        ) : null}

        {secondaryFilters ? (
          <div className="hidden md:flex items-center gap-1.5 flex-wrap">
            {secondaryFilters}
          </div>
        ) : null}

        {secondaryFilters ? (
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            aria-expanded={mobileFiltersOpen}
            className="md:hidden inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-[var(--ws-border)] text-xs font-medium text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)]"
          >
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Filters</span>
          </button>
        ) : null}
      </div>

      {/* Right: View mode toggle + More menu */}
      {(viewMode || moreMenu) ? (
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {viewMode ? <div className="flex items-center">{viewMode}</div> : null}
          {moreMenu ? <div className="flex items-center">{moreMenu}</div> : null}
        </div>
      ) : null}

      {/* Mobile secondary filters drawer */}
      {mobileFiltersOpen && secondaryFilters ? (
        <div className="md:hidden w-full pt-2 mt-2 border-t border-[var(--ws-border)] flex flex-wrap gap-2 animate-fade-in">
          {secondaryFilters}
        </div>
      ) : null}
    </div>
  );
}

export default WorkspaceToolbar;
