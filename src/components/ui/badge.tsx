'use client';

import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'border-transparent bg-white text-slate-950',
  secondary: 'border-transparent bg-slate-800 text-slate-200',
  outline: 'border-white/10 bg-transparent text-slate-200',
  destructive: 'border-transparent bg-rose-600 text-white',
};

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-none',
        variants[variant],
        className,
      ].join(' ')}
      {...props}
    />
  );
}
