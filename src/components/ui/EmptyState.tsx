'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center mx-auto max-w-[400px]',
        className
      )}
    >
      <div className="w-12 h-12 rounded-lg ac-workspace-panel flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-[var(--ws-text-tertiary)]" strokeWidth={1.5} />
      </div>
      <h3 className={cn(WORKSPACE.typography.pageTitle, 'mb-2')}>{title}</h3>
      <p className="text-[13px] text-[var(--ws-text-secondary)] leading-relaxed mb-6">{description}</p>
      {action}
      {!action && actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="ac-workspace-action-btn ac-workspace-action-btn--primary min-h-9 px-4"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
