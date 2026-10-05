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

/**
 * AlphaClone OS Button — semantic token-driven.
 *
 * Variant semantics:
 *   primary     — coral CTA: brand's primary action (high-signal, use sparingly)
 *   secondary   — teal: supportive action
 *   default     — neutral ghost with border: low-emphasis action
 *   outline     — bordered transparent: same weight as default, style alias
 *   ghost       — no border/bg: tertiary text-only action
 *   danger      — error-spectrum: destructive or high-risk actions
 *   destructive — alias of danger
 *   cta         — prominent gradient CTA (marketing contexts; sparingly in app)
 *   icon        — icon-only circular/rounded control
 *   navigation  — full-width left-aligned for nav lists
 */
const variants: Record<ButtonVariant, string> = {
  // Primary CTA — coral (brand anchor color for interactive primary)
  primary:
    'bg-[var(--interactive-primary)] text-white hover:bg-[var(--interactive-primary-hover)] active:scale-[0.98]',
  // Secondary action — teal (brand intelligence color)
  secondary:
    'bg-[var(--interactive-secondary)] text-white hover:bg-[var(--interactive-secondary-hover)] active:scale-[0.98]',
  // Default / neutral — outlined ghost, adapts to light/dark
  default:
    'border border-[var(--ws-border,var(--border-default))] bg-[var(--ws-panel,transparent)] text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)] active:scale-[0.98]',
  // Outline — same visual weight as default (style alias kept for consumers)
  outline:
    'border border-[var(--ws-border,var(--border-default))] bg-transparent text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)] active:scale-[0.98]',
  // Ghost — no bg or border; for tertiary/inline actions
  ghost:
    'bg-transparent text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]',
  // Danger / destructive
  danger:
    'bg-[var(--error-500,#D64545)] text-white hover:bg-[var(--error-600,#B93636)] active:scale-[0.98]',
  destructive:
    'bg-[var(--error-500,#D64545)] text-white hover:bg-[var(--error-600,#B93636)] active:scale-[0.98]',
  // Icon-only button (square)
  icon:
    'bg-transparent text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]',
  // Navigation item (full-width, left-aligned)
  navigation:
    'w-full justify-start text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]',
  // Prominent branded gradient CTA — use sparingly (marketing sections / onboarding)
  cta:
    'bg-gradient-to-r from-[var(--ac-accent)] to-[var(--ac-accent-deep)] text-white shadow-md hover:brightness-110 active:scale-[0.98]',
};

const sizes: Record<ButtonSize, string> = {
  default: 'h-10 px-4 py-2 type-ui rounded-lg min-h-11 min-w-11',
  sm:      'h-8 px-3 type-caption rounded-md min-h-9 min-w-9',
  md:      'h-10 px-4 py-2 type-ui rounded-lg min-h-11 min-w-11',
  lg:      'h-12 px-6 text-base rounded-xl min-h-12 min-w-12',
  icon:    'h-10 w-10 p-0 rounded-lg min-h-10 min-w-10',
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
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-app)]',
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
