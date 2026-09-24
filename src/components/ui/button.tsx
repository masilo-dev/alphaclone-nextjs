'use client';

import React from 'react';

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'destructive'
  | 'icon'
  | 'navigation'
  | 'cta';

export type ButtonSize = 'default' | 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  default: 'bg-white text-slate-950 hover:bg-slate-100 active:scale-[0.98]',
  primary: 'bg-white text-slate-950 hover:bg-slate-100 active:scale-[0.98]',
  secondary: 'bg-slate-800 text-white hover:bg-slate-700 active:scale-[0.98]',
  outline: 'border border-white/10 bg-transparent text-slate-200 hover:bg-white/5 active:scale-[0.98]',
  ghost: 'bg-transparent text-slate-300 hover:bg-white/5 hover:text-white',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 active:scale-[0.98]',
  destructive: 'bg-rose-600 text-white hover:bg-rose-500 active:scale-[0.98]',
  icon: 'bg-transparent text-slate-300 hover:bg-white/5 hover:text-white',
  navigation: 'w-full justify-start text-slate-300 hover:bg-white/5 hover:text-white',
  cta: 'bg-gradient-to-r from-[#5f8fff] to-[#356af4] text-white shadow-lg hover:brightness-110 active:scale-[0.98]',
};

const sizes: Record<ButtonSize, string> = {
  default: 'h-10 px-4 py-2 type-ui rounded-lg min-h-11 min-w-11',
  sm: 'h-8 px-3 type-caption rounded-md min-h-9 min-w-9',
  md: 'h-10 px-4 py-2 type-ui rounded-lg min-h-11 min-w-11',
  lg: 'h-12 px-6 text-base rounded-xl min-h-12 min-w-12',
  icon: 'h-10 w-10 p-0 rounded-lg min-h-10 min-w-10',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'default',
      size = 'default',
      type = 'button',
      disabled = false,
      isLoading = false,
      ...props
    },
    ref
  ) => {
    const isActuallyDisabled = Boolean(disabled || isLoading);

    return (
      <button
        ref={ref}
        type={type}
        disabled={isActuallyDisabled}
        aria-busy={isLoading || undefined}
        aria-disabled={isActuallyDisabled || undefined}
        className={[
          'inline-flex items-center justify-center gap-2 font-medium transition-all select-none touch-manipulation',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#356AF4)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-app,#0C1220)]',
          'disabled:cursor-[var(--interactive-disabled-cursor,not-allowed)] disabled:opacity-[var(--interactive-disabled-opacity,0.5)]',
          '[&:not(:disabled)]:cursor-[var(--interactive-cursor,pointer)] [&:not(:disabled)]:pointer-events-auto',
          variants[variant],
          sizes[size],
          className,
        ].join(' ')}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

