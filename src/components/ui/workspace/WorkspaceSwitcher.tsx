'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveCanonicalPath } from '@/lib/dashboard/canonicalRoutes';

export interface WorkspaceOption {
  label: string;
  href: string;
  badge?: string | number;
  description?: string;
}

interface WorkspaceSwitcherProps {
  currentLabel: string;
  options: WorkspaceOption[];
  currentHref?: string;
  moduleName?: string;
  className?: string;
}

/**
 * Compact Workspace Switcher.
 * Lets users switch between sibling workspaces (e.g. Leads / Contacts / Deals)
 * without rendering 12 horizontal tabs across the top of the working area.
 */
export function WorkspaceSwitcher({
  currentLabel,
  options,
  currentHref,
  moduleName,
  className,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div ref={dropdownRef} className={cn('relative inline-flex items-center', className)}>
      {moduleName ? (
        <span className="text-[var(--ws-text-muted)] text-sm font-medium mr-1.5 hidden sm:inline">
          {moduleName} /
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg font-bold text-base md:text-lg text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)] transition-colors"
      >
        <span>{currentLabel}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-[var(--ws-text-muted)] transition-transform duration-150',
            open && 'rotate-180 text-[var(--ws-text-primary)]'
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1.5 w-60 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] py-1.5 shadow-xl z-50 animate-fade-in"
        >
          {options.map((option) => {
            const isSelected = Boolean(
              option.label.toLowerCase() === currentLabel.toLowerCase() ||
              (currentHref && (
                resolveCanonicalPath(currentHref) === resolveCanonicalPath(option.href) ||
                currentHref === option.href ||
                currentHref.startsWith(option.href)
              ))
            );

            return (
              <button
                key={option.href}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setOpen(false);
                  router.push(option.href);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2 text-left text-sm transition-colors',
                  isSelected
                    ? 'bg-[var(--ws-hover)] font-semibold text-[var(--ws-text-primary)]'
                    : 'text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]'
                )}
              >
                <div className="min-w-0 pr-2">
                  <div className="truncate">{option.label}</div>
                  {option.description ? (
                    <div className="text-xs text-[var(--ws-text-muted)] truncate">
                      {option.description}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {option.badge != null ? (
                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-[var(--ws-surface)] text-[var(--ws-text-muted)] border border-[var(--ws-border)]">
                      {option.badge}
                    </span>
                  ) : null}
                  {isSelected ? (
                    <Check className="w-4 h-4 text-[var(--brand-blue-400)]" aria-hidden="true" />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default WorkspaceSwitcher;
