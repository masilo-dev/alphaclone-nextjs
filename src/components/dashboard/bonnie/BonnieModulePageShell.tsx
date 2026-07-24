'use client';

import React, { createContext, useContext } from 'react';
import { cn } from '@/lib/utils';
import BonnieModuleDock from './BonnieModuleDock';

const BonnieDockMountedContext = createContext(false);

type BonnieModulePageShellProps = {
  children: React.ReactNode;
  className?: string;
  /** When false, render children only (e.g. full-bleed editors). Default true. */
  showBonnieDock?: boolean;
};

/**
 * Module pages get a collapsible Bonnie dock so AI help lives inside every workspace.
 * Nested shells skip a second dock when already wrapped by a hub.
 */
export function BonnieModulePageShell({
  children,
  className,
  showBonnieDock = true,
}: BonnieModulePageShellProps) {
  const alreadyMounted = useContext(BonnieDockMountedContext);

  if (!showBonnieDock || alreadyMounted) {
    return <div className={className}>{children}</div>;
  }

  return (
    <BonnieDockMountedContext.Provider value={true}>
      <div className={cn('flex flex-col xl:flex-row gap-4 min-h-0', className)}>
        <div className="flex-1 min-w-0 min-h-0">{children}</div>
        <aside className="w-full xl:w-[360px] xl:max-w-[380px] flex-shrink-0 xl:sticky xl:top-2 xl:self-start">
          <BonnieModuleDock />
        </aside>
      </div>
    </BonnieDockMountedContext.Provider>
  );
}
