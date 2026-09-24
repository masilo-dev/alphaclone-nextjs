'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { WORKSPACE_FOCUS } from '@/constants/design';
import { HelpDisclosure } from './HelpDisclosure';

export interface WorkspaceHeaderProps {
  /** The workspace title string (e.g. "Leads", "Invoices", "Facebook") */
  title?: string;
  /** Optional custom title element (such as a WorkspaceSwitcher dropdown) */
  customTitle?: React.ReactNode;
  /** Optional subtitle or description (rendered concisely) */
  description?: string;
  /** Optional status pill or count badge */
  badge?: React.ReactNode;
  /** The primary action button (e.g. "+ Add Lead", "+ Create Invoice") */
  primaryAction?: React.ReactNode;
  /** Optional secondary action buttons */
  secondaryActions?: React.ReactNode;
  /** Optional educational content for progressive disclosure behind "? Help" */
  helpContent?: React.ReactNode;
  helpTitle?: string;
  className?: string;
  /** Density setting */
  density?: 'compact' | 'comfortable';
}

/**
 * Universal Workspace Header.
 * Replaces redundant 3-layer headers with ONE clear header:
 * Workspace Title / Switcher | Primary Action | Controls | Help.
 */
export function WorkspaceHeader({
  title,
  customTitle,
  description,
  badge,
  primaryAction,
  secondaryActions,
  helpContent,
  helpTitle = 'How this works',
  className,
  density = 'comfortable',
}: WorkspaceHeaderProps) {
  const densityStyles = WORKSPACE_FOCUS.density[density];

  return (
    <header
      className={cn(
        'w-full flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--ws-border)] bg-[var(--ws-toolbar)]',
        densityStyles.header,
        className
      )}
    >
      {/* Left: Title + Switcher + Badge + Concise description */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          {customTitle ? (
            customTitle
          ) : title ? (
            <h1 className={WORKSPACE_FOCUS.typography.workspaceTitle}>{title}</h1>
          ) : null}

          {badge ? (
            <div className="shrink-0">{badge}</div>
          ) : null}

          {helpContent ? (
            <HelpDisclosure title={helpTitle} label="Help">
              {helpContent}
            </HelpDisclosure>
          ) : null}
        </div>

        {description ? (
          <p className={cn(WORKSPACE_FOCUS.typography.workspaceSubtitle, 'mt-0.5')}>
            {description}
          </p>
        ) : null}
      </div>

      {/* Right: Actions (Primary button always visible, secondary actions) */}
      {(primaryAction || secondaryActions) ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {secondaryActions ? (
            <div className="flex items-center gap-1.5">{secondaryActions}</div>
          ) : null}
          {primaryAction ? (
            <div className="shrink-0">{primaryAction}</div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

export default WorkspaceHeader;
