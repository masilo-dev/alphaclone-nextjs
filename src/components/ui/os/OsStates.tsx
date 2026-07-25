'use client';

import type { ReactNode } from 'react';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

interface StateShellProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  tone?: 'default' | 'error' | 'warning' | 'permission';
}

export function OsEmptyState({ title, description, action, className }: StateShellProps) {
  return (
    <div className={cn(WORKSPACE.panel.base, 'p-8 text-center', className)}>
      <h3 className="text-base font-semibold text-[var(--ws-text-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--ws-text-secondary)] max-w-md mx-auto">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function OsErrorState({ title, description, action, className }: StateShellProps) {
  return (
    <div
      className={cn(
        WORKSPACE.panel.base,
        'p-6 border-[var(--error-border)] bg-[var(--error-surface)]',
        className
      )}
    >
      <h3 className="text-base font-semibold text-[var(--error-text)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--ws-text-secondary)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function OsPermissionState({ title, description, action, className }: StateShellProps) {
  return (
    <div className={cn(WORKSPACE.panel.base, 'p-6', className)}>
      <h3 className="text-base font-semibold text-[var(--ws-text-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--ws-text-secondary)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function OsLoadingBlock({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn(WORKSPACE.panel.base, 'p-4 space-y-3 ac-skeleton-pulse', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-[var(--ws-surface-tertiary)]" />
      ))}
    </div>
  );
}
