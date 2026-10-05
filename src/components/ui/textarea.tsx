'use client';

import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={[
        'flex min-h-20 w-full rounded-lg border border-[var(--ws-border)] bg-[var(--ws-canvas)]/60 px-3 py-2 type-ui text-[var(--ws-text-primary)] placeholder:text-[var(--ws-text-muted)] focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ].join(' ')}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';
