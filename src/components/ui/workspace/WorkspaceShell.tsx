'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { WORKSPACE_FOCUS } from '@/constants/design';

export interface WorkspaceShellProps {
  children: React.ReactNode;
  /** Full-bleed mode for tables/canvases that own their own scroll */
  fullBleed?: boolean;
  className?: string;
  /** Optional container max-width */
  contained?: boolean;
}

/**
 * Universal Workspace Shell.
 * The top-level layout wrapper for focused workspace views.
 * Ensures consistent padding, scroll bounds, and max-width.
 */
export function WorkspaceShell({
  children,
  fullBleed = false,
  contained = true,
  className,
}: WorkspaceShellProps) {
  return (
    <div
      className={cn(
        'w-full min-w-0 flex flex-col',
        fullBleed ? 'h-full min-h-0 flex-1 overflow-hidden' : 'min-h-full pb-20 md:pb-8',
        contained && !fullBleed ? WORKSPACE_FOCUS.container : '',
        className
      )}
    >
      {children}
    </div>
  );
}

export default WorkspaceShell;
