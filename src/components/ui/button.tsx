'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { WORKSPACE } from '@/constants/design';

export type ButtonVariant = 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'destructive' | 'icon' | 'navigation' | 'cta';
export type ButtonSize = 'default' | 'sm' | 'md' | 'lg' | 'icon';
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

/** Canonical control. Translation remains in the compatible labeled UI adapter. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children, className = '', variant = 'default', size = 'default', isLoading = false,
  disabled = false, icon, type = 'button', ...props
}, ref) => {
  const isActuallyDisabled = Boolean(disabled || isLoading);
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all select-none touch-manipulation ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,var(--brand-blue-500))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-app)] ' +
    'disabled:cursor-[var(--interactive-disabled-cursor,not-allowed)] disabled:opacity-[var(--interactive-disabled-opacity,0.5)] ' +
    '[&:not(:disabled)]:cursor-[var(--interactive-cursor,pointer)] [&:not(:disabled)]:pointer-events-auto';

  const variants: Record<string, string> = {
    primary: `${WORKSPACE.action.primary} border-0 active:scale-[0.98]`,
    default: `${WORKSPACE.action.primary} border-0 active:scale-[0.98]`,
    secondary: "bg-[var(--interactive-secondary,var(--brand-teal))] text-[var(--text-inverse)] hover:bg-[var(--interactive-secondary-hover)] active:scale-[0.98]",
    outline: "border border-[var(--border-default)] bg-[var(--surface-primary)] text-[var(--text-primary)] hover:bg-[var(--surface-hover,var(--ws-panel))] active:scale-[0.98]",
    ghost: "text-[var(--text-secondary)] hover:bg-[var(--surface-hover,var(--ws-panel))] hover:text-[var(--text-primary)]",
    danger: "bg-[var(--danger,var(--error-500))] text-[var(--text-inverse)] hover:brightness-95 active:scale-[0.98]",
    destructive: "bg-[var(--danger,var(--error-500))] text-[var(--text-inverse)] hover:brightness-95 active:scale-[0.98]",
    icon: "bg-transparent hover:bg-[var(--surface-hover,var(--ws-panel))] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
    navigation: `${WORKSPACE.nav.item} justify-start`,
    cta: "bg-gradient-to-r from-[var(--brand-blue-400)] to-[var(--brand-blue-500)] text-[var(--text-inverse)] shadow-lg hover:brightness-110 active:scale-[0.98]",
  };

  const sizes: Record<string, string> = {
    sm: "h-8 px-3 type-caption min-h-9 min-w-9 rounded-[8px]",
    md: "h-10 px-4 py-2 type-ui min-h-11 min-w-11 rounded-[10px]",
    lg: "h-12 px-6 text-base min-h-12 min-w-12 rounded-[12px]",
    default: "h-10 px-4 py-2 type-ui min-h-11 min-w-11 rounded-[10px]",
    icon: "h-10 w-10 p-0 min-h-11 min-w-11 rounded-[10px]",
  };

  const visualVariant = variant === 'default' ? 'outline' : variant;
  return (
    <button ref={ref} type={type} disabled={isActuallyDisabled}
      aria-busy={isLoading || undefined} aria-disabled={isActuallyDisabled || undefined}
      className={`${baseStyles} ${variants[visualVariant]} ${sizes[size]} ${className}`} {...props}>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {!isLoading && icon && <span className="mr-2 flex items-center" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
});
Button.displayName = 'Button';
