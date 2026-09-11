'use client';

import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default:
    'border-transparent bg-[var(--ac-accent-muted)] text-[var(--ac-accent)]',
  secondary:
    'border-transparent bg-[var(--ws-surface-secondary,var(--surface-secondary))] text-[var(--ws-text-secondary,var(--text-secondary))]',
  outline:
    'border-[var(--ws-border,var(--border-default))] bg-transparent text-[var(--ws-text-secondary,var(--text-secondary))]',
  destructive:
    'border-transparent bg-[var(--error-600,var(--danger))] text-white',
};

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-none tracking-[0.01em]',
        variants[variant],
        className,
      ].join(' ')}
      {...props}
    />
  );
}
