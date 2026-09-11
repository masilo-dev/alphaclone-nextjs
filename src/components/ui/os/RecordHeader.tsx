'use client';

import type { ReactNode } from 'react';
import type { ModuleId } from '@/constants/brand';
import { MODULE_IDENTITY } from '@/constants/brand';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

interface RecordHeaderProps {
  moduleId?: ModuleId;
  title: string;
  subtitle?: string;
  status?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared record detail header — identity, status, and primary actions.
 * Tabs / timeline content stay in the page body.
 */
export function RecordHeader({
  moduleId,
  title,
  subtitle,
  status,
  meta,
  actions,
  className,
}: RecordHeaderProps) {
  const accent = moduleId ? MODULE_IDENTITY[moduleId].primary : 'var(--brand-blue-500)';

  return (
    <header
      className={cn(
        WORKSPACE.panel.base,
        'p-4 md:p-5 flex flex-wrap items-start justify-between gap-4',
        className
      )}
      style={{ ['--module-accent' as string]: accent }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ background: accent }}
            aria-hidden
          />
          <h1 className="text-[22px] leading-7 font-bold text-[var(--ws-text-primary)] tracking-tight truncate">
            {title}
          </h1>
          {status}
        </div>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--ws-text-secondary)]">{subtitle}</p>
        ) : null}
        {meta ? <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ws-text-muted)]">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
