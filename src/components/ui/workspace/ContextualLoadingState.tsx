'use client';

import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 6, columns = 5, className }: TableSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading table data"
      className={cn('w-full border border-[var(--ws-border)] rounded-xl overflow-hidden bg-[var(--ws-surface)]', className)}
    >
      {/* Table Header Skeleton */}
      <div className="flex items-center gap-4 px-4 py-3 bg-[var(--ws-toolbar)] border-b border-[var(--ws-border)]">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="h-3.5 bg-[var(--ws-hover)] rounded animate-pulse"
            style={{ width: `${Math.max(60, 100 - i * 15)}px` }}
          />
        ))}
      </div>

      {/* Table Rows Skeleton */}
      <div className="divide-y divide-[var(--ws-border)]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
            {Array.from({ length: columns }).map((_, c) => (
              <div
                key={c}
                className="h-3 bg-[var(--ws-hover)] rounded"
                style={{
                  width: c === 0 ? '160px' : c === 1 ? '100px' : '75px',
                  opacity: 1 - r * 0.1,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export function CardSkeleton({ count = 3, className }: CardSkeletonProps) {
  return (
    <div role="status" aria-label="Loading content" className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] space-y-3 animate-pulse"
        >
          <div className="h-4 bg-[var(--ws-hover)] rounded w-2/3" />
          <div className="h-3 bg-[var(--ws-hover)] rounded w-1/2" />
          <div className="h-16 bg-[var(--ws-hover)]/60 rounded" />
          <div className="flex justify-between pt-2">
            <div className="h-3 bg-[var(--ws-hover)] rounded w-1/4" />
            <div className="h-3 bg-[var(--ws-hover)] rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface InlineOperationStateProps {
  /** Explicit text describing what is happening (e.g. 'Publishing to LinkedIn...', 'Sending invoice...') */
  text: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function InlineOperationState({ text, className, size = 'sm' }: InlineOperationStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 text-[var(--ws-text-secondary)] font-medium animate-fade-in',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className
      )}
    >
      <Loader2 className={cn('animate-spin text-[var(--brand-blue-400)]', size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
      <span>{text}</span>
    </div>
  );
}
