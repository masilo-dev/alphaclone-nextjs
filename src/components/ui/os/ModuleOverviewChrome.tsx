'use client';

import type { ReactNode } from 'react';
import type { ModuleId } from '@/constants/brand';
import { SubNavigation } from './SubNavigation';
import { getModuleSubnav } from '@/lib/dashboard/moduleSubnav';
import { cn } from '@/lib/utils';

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
  const items = getModuleSubnav(moduleId);
  return (
    <div
      className={cn('space-y-4 ac-scroll-full ac-module-section', className)}
      data-module={moduleId}
    >
      {!hideSubnav && items.length > 1 ? (
        <SubNavigation moduleId={moduleId} items={items} activeHref={activeHref} />
      ) : null}
      {children}
    </div>
  );
}
