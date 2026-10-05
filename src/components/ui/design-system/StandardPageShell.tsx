'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Untitled-aligned page shell for authenticated modules.
 * Surfaces are fully theme-token driven (light + dark).
 */
export function StandardPageShell({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('ac-untitled-page flex min-h-0 flex-1 flex-col gap-5', className)}>
      {(title || description || actions) && (
        <header className="ac-untitled-page__header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {title ? (
              <h1 className="truncate text-[length:var(--type-page-title-size,1.5rem)] font-semibold tracking-tight text-[var(--ws-text-primary)]">
                {title}
              </h1>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-sm text-[var(--ws-text-muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
        </header>
      )}
      <div className="ac-untitled-page__body min-h-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Untitled-aligned panel / card surface.
 * Prefer this over ad-hoc bg-slate / text-[var(--ws-text-primary)] shells.
 */
export function StandardPanel({
  children,
  className,
  padding = 'md',
  as: Comp = 'section',
}: {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  as?: 'section' | 'div' | 'article' | 'aside';
}) {
  const pad =
    padding === 'none'
      ? ''
      : padding === 'sm'
        ? 'p-3'
        : padding === 'lg'
          ? 'p-6'
          : 'p-4 md:p-5';

  return (
    <Comp
      className={cn(
        'ac-untitled-panel ac-workspace-panel rounded-[var(--ws-radius-lg)] border border-[var(--ws-border)] bg-[var(--ws-panel)] text-[var(--ws-text-primary)] shadow-[var(--ws-card-shadow)]',
        pad,
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export function StandardSectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-[var(--ws-text-primary)]">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-[var(--ws-text-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
