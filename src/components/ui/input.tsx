'use client';

import React from 'react';

export const FIELD_CONTROL_CLASS = 'flex min-h-11 w-full rounded-[var(--ws-radius-control,var(--radius-md,8px))] border border-[var(--color-border-primary,var(--ws-border,var(--border-default)))] bg-[var(--color-bg-primary,var(--ws-surface-primary,var(--surface-primary)))] px-3 py-2 type-ui text-[var(--color-text-primary,var(--ws-text-primary,var(--text-primary)))] placeholder:text-[var(--color-text-placeholder,var(--ws-text-tertiary,var(--text-muted)))] shadow-sm outline-none transition-[border-color,background-color,box-shadow] duration-150 focus-visible:border-[var(--color-border-brand,var(--ac-accent))] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={[
        FIELD_CONTROL_CLASS,
        className,
      ].join(' ')}
      {...props}
    />
  )
);
Input.displayName = 'Input';
