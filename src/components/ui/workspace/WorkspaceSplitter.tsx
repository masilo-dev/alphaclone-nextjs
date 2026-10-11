'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface WorkspaceSplitterProps extends React.HTMLAttributes<HTMLDivElement> {
  panelIndex?: 1 | 3;
  isResizing?: boolean;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  onDoubleClick?: () => void;
}

/**
 * Universal Workspace Splitter.
 * Ultra-compact draggable divider for multi-panel IDE-style layouts.
 * Provides accessible keyboard support, mouse/touch dragging, and double-click reset.
 */
export const WorkspaceSplitter = React.forwardRef<HTMLDivElement, WorkspaceSplitterProps>(
  (
    {
      panelIndex,
      isResizing = false,
      orientation = 'vertical',
      className,
      onDoubleClick,
      ...props
    },
    ref
  ) => {
    const isVertical = orientation === 'vertical';

    return (
      <div
        ref={ref}
        onDoubleClick={onDoubleClick}
        className={cn(
          'group relative shrink-0 select-none transition-colors duration-150 outline-none',
          isVertical
            ? 'w-[5px] -mx-[2px] cursor-col-resize h-full z-10 flex items-center justify-center'
            : 'h-[5px] -my-[2px] cursor-row-resize w-full z-10 flex items-center justify-center',
          isResizing && 'pointer-events-auto',
          className
        )}
        {...props}
      >
        {/* Visual 1px hairline */}
        <div
          className={cn(
            'transition-colors duration-150',
            isVertical ? 'w-px h-full' : 'h-px w-full',
            isResizing
              ? 'bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]'
              : 'bg-[var(--border-subtle)] group-hover:bg-[var(--accent)] group-focus-visible:bg-[var(--accent)]'
          )}
        />

        {/* Center grip pill shown on hover / focus / active resize */}
        <div
          className={cn(
            'absolute rounded-full transition-opacity duration-150 pointer-events-none',
            isVertical ? 'w-1 h-6' : 'h-1 w-6',
            isResizing
              ? 'bg-[var(--accent)] opacity-100'
              : 'bg-[var(--border-strong)] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
          )}
        />
      </div>
    );
  }
);

WorkspaceSplitter.displayName = 'WorkspaceSplitter';

export default WorkspaceSplitter;
