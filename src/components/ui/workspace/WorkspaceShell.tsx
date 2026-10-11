'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { WORKSPACE_FOCUS } from '@/constants/design';

export interface WorkspaceShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Full-bleed mode for tables/canvases that own their own scroll */
  fullBleed?: boolean;
  className?: string;
  /** Optional container max-width */
  contained?: boolean;
  /** Multi-panel continuous IDE-style layout (flex-row, overflow-hidden) */
  multiPanel?: boolean;
}

/**
 * Universal Workspace Shell.
 * The top-level layout wrapper for focused workspace views and multi-panel workspaces.
 * Ensures continuous, edge-to-edge layout bounds without viewport overflow.
 */
export const WorkspaceShell = React.forwardRef<HTMLDivElement, WorkspaceShellProps>(
  (
    {
      children,
      fullBleed = false,
      contained = true,
      multiPanel = false,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'w-full min-w-0',
          multiPanel
            ? 'flex flex-row h-full min-h-0 flex-1 overflow-hidden bg-[var(--app-bg)]'
            : fullBleed
            ? 'flex flex-col h-full min-h-0 flex-1 overflow-hidden'
            : 'flex flex-col min-h-full pb-20 md:pb-8',
          contained && !fullBleed && !multiPanel ? WORKSPACE_FOCUS.container : '',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

WorkspaceShell.displayName = 'WorkspaceShell';

export default WorkspaceShell;
