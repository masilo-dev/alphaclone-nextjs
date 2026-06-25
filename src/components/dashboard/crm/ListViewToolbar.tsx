'use client';

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
        <div className="flex flex-1 items-center gap-2 bg-slate-900 border border-white/5 rounded-xl px-3 h-10">
          <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
          />
          {search && (
            <button onClick={() => onSearchChange('')} className="text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {onViewModeChange && viewMode && (
          <div className="flex rounded-lg border border-white/5 bg-slate-900 p-0.5">
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-teal-500 text-white' : 'text-slate-400'}`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('board')}
              className={`p-2 rounded-md ${viewMode === 'board' ? 'bg-teal-500 text-white' : 'text-slate-400'}`}
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
          <SlidersHorizontal className="w-4 h-4 text-slate-500 flex-shrink-0 mt-2" />
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`flex-shrink-0 h-8 px-3 rounded-full text-xs font-bold border transition-all ${
                activeFilter === f.value
                  ? 'bg-teal-500 text-white border-teal-500'
                  : 'bg-slate-900 text-slate-400 border-white/5 hover:border-teal-500/30'
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
