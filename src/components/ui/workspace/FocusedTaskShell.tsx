'use client';

import React from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface FocusedTaskShellProps {
  /** The action title (e.g. "Create Invoice", "Compose Post") */
  title: string;
  /** Subtitle or breadcrumb context (e.g. "Acme Corp · Draft") */
  subtitle?: string;
  /** Back or cancel handler */
  onClose?: () => void;
  /** Primary submit action button or node */
  actions?: React.ReactNode;
  /** Save draft or secondary button */
  secondaryAction?: React.ReactNode;
  /** Form body content */
  children: React.ReactNode;
  className?: string;
  /** Content width constraint (default max-w-4xl) */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
}

const MAX_WIDTHS = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-full',
};

/**
 * Focused Task Shell.
 * Provides a dedicated, distraction-free container for creation and editing tasks
 * (Create Invoice, Compose Post, Edit Contact, etc.).
 * Strips away outer module navigation, dashboards, and analytics so the user can complete the task.
 */
export function FocusedTaskShell({
  title,
  subtitle,
  onClose,
  actions,
  secondaryAction,
  children,
  className,
  maxWidth = '4xl',
}: FocusedTaskShellProps) {
  return (
    <div className={cn('min-h-full flex flex-col bg-[var(--ws-canvas)] text-[var(--ws-text-primary)]', className)}>
      {/* Sticky Task Header */}
      <header className="sticky top-0 z-30 h-14 min-h-14 border-b border-[var(--ws-border)] bg-[var(--ws-toolbar)]/95 backdrop-blur-md px-4 md:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -ml-1.5 rounded-lg text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)] transition-colors"
              aria-label="Back / Cancel"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-bold text-[var(--ws-text-primary)] tracking-tight truncate">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-xs text-[var(--ws-text-muted)] truncate">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {secondaryAction ? secondaryAction : null}
          {actions ? actions : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)] sm:hidden"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </header>

      {/* Form Content */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
        <div className={cn('mx-auto w-full', MAX_WIDTHS[maxWidth])}>
          {children}
        </div>
      </main>
    </div>
  );
}

export default FocusedTaskShell;
