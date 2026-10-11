'use client';

import React from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkspacePanelToggleProps {
  panel: 'left' | 'right';
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  badge?: number | string | null;
  tooltip?: string;
  size?: 'sm' | 'md';
}

/**
 * Compact panel collapse / expand toggle button.
 * Matches VS Code / IDE navigation controls.
 */
export function WorkspacePanelToggle({
  panel,
  collapsed,
  onToggle,
  className,
  badge,
  tooltip,
  size = 'sm',
}: WorkspacePanelToggleProps) {
  const isLeft = panel === 'left';
  const label =
    tooltip ||
    (isLeft
      ? collapsed
        ? 'Expand navigation panel'
        : 'Collapse navigation panel'
      : collapsed
      ? 'Expand context panel'
      : 'Collapse context panel');

  const Icon = isLeft
    ? collapsed
      ? PanelLeftOpen
      : PanelLeftClose
    : collapsed
    ? PanelRightOpen
    : PanelRightClose;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] transition-colors',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        className
      )}
    >
      <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      {badge ? (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-[var(--text-inverse)]">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export default WorkspacePanelToggle;
