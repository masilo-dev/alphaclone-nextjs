'use client';

import type { ReactNode } from 'react';
import { MODULE_IDENTITY, type ModuleId } from '@/constants/brand';
import { SubNavigation } from './SubNavigation';
import { getModuleSubnav } from '@/lib/dashboard/moduleSubnav';
import { cn } from '@/lib/utils';
import { useDeviceExperience } from '@/hooks/useDeviceExperience';

interface ModuleOverviewChromeProps {
  moduleId: ModuleId;
  activeHref: string;
  children: ReactNode;
  className?: string;
  /** Hide submodule tabs when the parent hub already covers them tightly */
  hideSubnav?: boolean;
}

/** Lightweight chrome for module overview pages already wrapped by HubShell. */
export function ModuleOverviewChrome({
  moduleId,
  activeHref,
  children,
  className,
  hideSubnav,
}: ModuleOverviewChromeProps) {
  const { isInstalledMobileCompanion } = useDeviceExperience();
  const items = getModuleSubnav(moduleId);
  const identity = MODULE_IDENTITY[moduleId];

  if (isInstalledMobileCompanion) {
    return (
      <div className={cn('ac-scroll-full', className)} data-module={moduleId} data-native-module>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn('space-y-4 ac-scroll-full ac-module-section', className)}
      data-module={moduleId}
    >
      <div className="flex items-start justify-between gap-3 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/70 px-4 py-3" data-tour="module-purpose">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ac-accent)]">{identity.label}</p>
          <p className="mt-1 text-sm text-[var(--ws-text-secondary)]">{identity.meaning}</p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--ws-border)] px-2 py-1 text-[10px] font-semibold text-[var(--ws-text-tertiary)]">What this area is for</span>
      </div>
      {!hideSubnav && items.length > 1 ? (
        <SubNavigation moduleId={moduleId} items={items} activeHref={activeHref} />
      ) : null}
      {children}
    </div>
  );
}
