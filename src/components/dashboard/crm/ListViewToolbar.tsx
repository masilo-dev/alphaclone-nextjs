'use client';

import { Input as AlphaCloneInput } from '@/components/ui/input';


import React from 'react';
import { Search, LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';

export type ViewMode = 'list' | 'board';

interface FilterChip {
  value: string;
  label: string;
}

interface ListViewToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filters?: FilterChip[];
  activeFilter?: string;
  onFilterChange?: (v: string) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (m: ViewMode) => void;
  actions?: React.ReactNode;
}

export default function ListViewToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  activeFilter = 'all',
  onFilterChange,
  viewMode,
  onViewModeChange,
  actions,
}: ListViewToolbarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-xl px-3 h-10">
          <Search className="w-4 h-4 text-[var(--ws-text-muted)] flex-shrink-0" />
          <AlphaCloneInput
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1"
          />
          {search && (
            <button onClick={() => onSearchChange('')} className="text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {onViewModeChange && viewMode && (
          <div className="flex rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] p-0.5">
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-teal-500 text-[var(--text-inverse)]' : 'text-[var(--ws-text-muted)]'}`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('board')}
              className={`p-2 rounded-md ${viewMode === 'board' ? 'bg-teal-500 text-[var(--text-inverse)]' : 'text-[var(--ws-text-muted)]'}`}
              aria-label="Board view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        )}
        {actions}
      </div>
      {filters.length > 0 && onFilterChange && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <SlidersHorizontal className="w-4 h-4 text-[var(--ws-text-muted)] flex-shrink-0 mt-2" />
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`flex-shrink-0 h-8 px-3 rounded-full type-caption font-bold border transition-all ${
                activeFilter === f.value
                  ? 'bg-teal-500 text-[var(--text-inverse)] border-teal-500'
                  : 'bg-[var(--ws-panel)] text-[var(--ws-text-muted)] border-[var(--ws-border)] hover:border-teal-500/30'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
