'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={[
        'flex min-h-11 w-full rounded-[var(--ws-radius-control,8px)] border border-[var(--ws-border,var(--border-default))] bg-[var(--ws-surface-primary,var(--surface-primary))] px-3 py-2 text-sm text-[var(--ws-text-primary,var(--text-primary))] placeholder:text-[var(--ws-text-tertiary,var(--text-muted))] shadow-sm outline-none transition-[border-color,background-color,box-shadow] duration-150 focus-visible:border-[var(--ac-accent)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ].join(' ')}
      {...props}
    />
  )
);
Input.displayName = 'Input';
