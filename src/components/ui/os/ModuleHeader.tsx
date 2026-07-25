'use client';

import type { ReactNode } from 'react';
import type { ModuleId } from '@/constants/brand';
import { MODULE_IDENTITY } from '@/constants/brand';
import { getModuleIcon } from '@/components/icons/alphaclone';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

interface ModuleHeaderProps {
  moduleId: ModuleId;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function ModuleHeader({
  moduleId,
  title,
  description,
  actions,
  className,
}: ModuleHeaderProps) {
  const identity = MODULE_IDENTITY[moduleId];
  const Icon = getModuleIcon(moduleId);

  return (
    <header
      className={cn('flex flex-wrap items-start justify-between gap-4', className)}
      style={{ ['--module-accent' as string]: identity.primary }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] shrink-0"
          style={{
            background: `color-mix(in srgb, ${identity.primary} 14%, transparent)`,
            color: identity.primary,
          }}
        >
          <Icon size={22} variant="duotone" decorative />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ background: identity.primary }}
              aria-hidden
            />
            <h1 className={WORKSPACE.typography.pageTitle}>{title ?? identity.label}</h1>
          </div>
          {description ? (
            <p className="mt-1 text-sm text-[var(--ws-text-secondary)] max-w-2xl">{description}</p>
          ) : (
            <p className="mt-1 text-sm text-[var(--ws-text-muted)]">{identity.meaning}</p>
          )}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
