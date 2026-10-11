'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { WorkspacePanelToggle } from './WorkspacePanelToggle';

export interface WorkspacePanelProps {
  id?: string;
  panelType?: 'nav' | 'primary' | 'context';
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  badge?: React.ReactNode;
  headerActions?: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
  collapsed?: boolean;
  collapsible?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

/**
 * Universal Workspace Panel.
 * The core block for IDE-style multi-panel workspaces (Navigation, Primary Editor, Context/Details).
 * Provides independent scrolling, compact headers, and seamless collapsing.
 */
export const WorkspacePanel = React.forwardRef<HTMLDivElement, WorkspacePanelProps>(
  (
    {
      id,
      panelType = 'primary',
      title,
      subtitle,
      icon: IconOrElement,
      badge,
      headerActions,
      toolbar,
      footer,
      width,
      minWidth,
      maxWidth,
      collapsed = false,
      collapsible = false,
      onToggleCollapse,
      className,
      headerClassName,
      contentClassName,
      children,
    },
    ref
  ) => {
    if (collapsed) {
      return null;
    }

    const isPrimary = panelType === 'primary';
    const isNav = panelType === 'nav';
    const isContext = panelType === 'context';

    const panelStyle: React.CSSProperties = {
      ...(width !== undefined && !isPrimary
        ? {
            width: typeof width === 'number' ? `${width}px` : width,
            minWidth: minWidth !== undefined ? `${minWidth}px` : undefined,
            maxWidth: maxWidth !== undefined ? `${maxWidth}px` : undefined,
          }
        : {}),
    };

    return (
      <aside
        id={id}
        ref={ref}
        style={panelStyle}
        className={cn(
          'flex flex-col h-full min-h-0 overflow-hidden transition-[width] duration-75',
          isPrimary
            ? 'flex-1 min-w-0 bg-[var(--app-bg)]'
            : 'shrink-0 bg-[var(--surface-1)]',
          isNav && 'border-r border-[var(--border-subtle)]',
          isContext && 'border-l border-[var(--border-subtle)]',
          className
        )}
      >
        {/* Compact Panel Header */}
        {(title || headerActions || collapsible) ? (
          <div
            className={cn(
              'flex h-9 items-center justify-between gap-2 px-3 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] shrink-0 select-none',
              headerClassName
            )}
          >
            {/* Left: Icon, Title, Badge, Subtitle */}
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              {collapsible && isNav && onToggleCollapse ? (
                <WorkspacePanelToggle
                  panel="left"
                  collapsed={false}
                  onToggle={onToggleCollapse}
                  className="mr-0.5"
                />
              ) : null}

              {IconOrElement ? (
                <span className="text-[var(--text-muted)] shrink-0 flex items-center">
                  {typeof IconOrElement === 'function' ? (
                    <IconOrElement className="w-3.5 h-3.5 text-[var(--accent)]" />
                  ) : (
                    IconOrElement
                  )}
                </span>
              ) : null}

              {title ? (
                <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                  <span className="text-xs font-bold tracking-tight text-[var(--text-primary)] uppercase truncate">
                    {title}
                  </span>
                  {subtitle ? (
                    <span className="text-[11px] text-[var(--text-muted)] font-normal truncate hidden sm:inline">
                      {subtitle}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {badge ? <div className="shrink-0">{badge}</div> : null}
            </div>

            {/* Right: Actions and Collapse toggle */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {headerActions}

              {collapsible && isContext && onToggleCollapse ? (
                <WorkspacePanelToggle
                  panel="right"
                  collapsed={false}
                  onToggle={onToggleCollapse}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Optional Secondary Toolbar */}
        {toolbar ? <div className="shrink-0">{toolbar}</div> : null}

        {/* Independent Scroll Content Area */}
        <div
          className={cn(
            'flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar',
            contentClassName
          )}
        >
          {children}
        </div>

        {/* Optional Footer */}
        {footer ? (
          <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-1)]">
            {footer}
          </div>
        ) : null}
      </aside>
    );
  }
);

WorkspacePanel.displayName = 'WorkspacePanel';

export default WorkspacePanel;
