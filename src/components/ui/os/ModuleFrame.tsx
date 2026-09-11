'use client';

import type { ReactNode } from 'react';
import type { ModuleId } from '@/constants/brand';
import { ModuleHeader } from './ModuleHeader';
import { AskBonnieButton } from './AskBonnieButton';
import { SubNavigation } from './SubNavigation';
import { getModuleSubnav } from '@/lib/dashboard/moduleSubnav';
import { cn } from '@/lib/utils';

interface ModuleFrameProps {
  moduleId: ModuleId;
  title?: string;
  description?: string;
  activeHref?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  hideSubnav?: boolean;
}

/**
 * Shared module chrome: identity header + structured subnavigation + content.
 * Wrap existing module views without replacing their business logic.
 */
export function ModuleFrame({
  moduleId,
  title,
  description,
  activeHref,
  actions,
  children,
  className,
  hideSubnav,
}: ModuleFrameProps) {
  const items = getModuleSubnav(moduleId);

  return (
    <div
      className={cn('ac-module-frame space-y-5 ac-scroll-full ac-enterprise-module', className)}
      data-module={moduleId}
      style={{ ['--module-accent' as string]: `var(--module-${moduleId}-primary, var(--brand-blue-500))` }}
    >
      <ModuleHeader
        moduleId={moduleId}
        title={title}
        description={description}
        actions={
          <>
            {actions}
            {moduleId !== 'bonnie' ? (
              <AskBonnieButton
                compact
                label="Work with Bonnie"
                className="ac-module-bonnie-action"
              />
            ) : null}
          </>
        }
      />
      {!hideSubnav && items.length > 1 ? (
        <SubNavigation moduleId={moduleId} items={items} activeHref={activeHref} />
      ) : null}
      <div className="ac-module-frame-body">{children}</div>
    </div>
  );
}
