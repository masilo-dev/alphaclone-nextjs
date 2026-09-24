'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Bookmark, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SavedViewOption {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  isDefault?: boolean;
}

export interface SavedViewsDropdownProps {
  /** Array of view presets */
  views: SavedViewOption[];
  /** Currently selected view ID */
  currentViewId: string;
  /** Callback on view selection */
  onSelectView: (viewId: string) => void;
  /** Optional callback to save current view filters */
  onSaveCurrentView?: (name: string) => void;
  className?: string;
}

export function SavedViewsDropdown({
  views,
  currentViewId,
  onSelectView,
  onSaveCurrentView,
  className,
}: SavedViewsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentView = views.find((v) => v.id === currentViewId) || views[0];

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSavingView(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (newViewName.trim() && onSaveCurrentView) {
      onSaveCurrentView(newViewName.trim());
      setNewViewName('');
      setSavingView(false);
      setOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} className={cn('relative inline-block text-left', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] text-xs font-semibold text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)] transition-colors'
        )}
      >
        <Bookmark className="w-3.5 h-3.5 text-[var(--ws-text-muted)]" aria-hidden="true" />
        <span className="truncate max-w-[120px]">{currentView?.label || 'Views'}</span>
        <ChevronDown
          className={cn(
            'w-3 h-3 text-[var(--ws-text-muted)] transition-transform duration-150',
            open && 'rotate-180 text-[var(--ws-text-primary)]'
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1 w-56 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] py-1 shadow-xl z-50 animate-fade-in"
        >
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ws-text-muted)] border-b border-[var(--ws-border)]">
            Saved Views
          </div>

          <div className="py-1 max-h-60 overflow-y-auto">
            {views.map((view) => {
              const isSelected = view.id === currentViewId;
              return (
                <button
                  key={view.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelectView(view.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors',
                    isSelected
                      ? 'bg-[var(--ws-hover)] font-semibold text-[var(--ws-text-primary)]'
                      : 'text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    {view.icon ? <span className="shrink-0">{view.icon}</span> : null}
                    <span className="truncate">{view.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {view.count !== undefined ? (
                      <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-[var(--ws-surface)] border border-[var(--ws-border)] text-[var(--ws-text-muted)]">
                        {view.count}
                      </span>
                    ) : null}
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-[var(--brand-blue-400)]" aria-hidden="true" />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {onSaveCurrentView ? (
            <div className="border-t border-[var(--ws-border)] p-1.5">
              {!savingView ? (
                <button
                  type="button"
                  onClick={() => setSavingView(true)}
                  className="w-full flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--brand-blue-400)] hover:bg-[var(--ws-hover)] rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save current filters as view</span>
                </button>
              ) : (
                <form onSubmit={handleSave} className="flex items-center gap-1 p-1">
                  <input
                    type="text"
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    placeholder="View name..."
                    className="flex-1 h-7 px-2 text-xs rounded border border-[var(--ws-border)] bg-[var(--ws-surface)] text-[var(--ws-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-blue-500)]"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="h-7 px-2 text-xs font-semibold rounded bg-[var(--brand-blue-500)] text-white hover:bg-[var(--brand-blue-600)]"
                  >
                    Save
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default SavedViewsDropdown;
