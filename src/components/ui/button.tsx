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
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-all select-none touch-manipulation ' +
    '[&_svg]:size-3.5 sm:[&_svg]:size-4 [&_svg]:shrink-0 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,var(--brand-blue-500))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-app)] ' +
    'disabled:cursor-[var(--interactive-disabled-cursor,not-allowed)] disabled:opacity-[var(--interactive-disabled-opacity,0.5)] ' +
    '[&:not(:disabled)]:cursor-[var(--interactive-cursor,pointer)] [&:not(:disabled)]:pointer-events-auto';

  const variants: Record<string, string> = {
    primary: `${WORKSPACE.action.primary} border-0 active:scale-[0.98]`,
    default: `${WORKSPACE.action.primary} border-0 active:scale-[0.98]`,
    secondary: "bg-[var(--interactive-secondary,var(--brand-teal))] text-[var(--text-inverse)] hover:bg-[var(--interactive-secondary-hover)] active:scale-[0.98]",
    outline: "border border-[var(--border-default)] bg-[var(--surface-primary)] text-[var(--text-primary)] hover:bg-[var(--surface-hover,var(--ws-panel))] active:scale-[0.98]",
    ghost: "text-[var(--text-secondary)] hover:bg-[var(--surface-hover,var(--ws-panel))] hover:text-[var(--text-primary)] active:scale-[0.98]",
    danger: "bg-[var(--danger,var(--error-500))] text-[var(--text-inverse)] hover:brightness-95 active:scale-[0.98]",
    destructive: "bg-[var(--danger,var(--error-500))] text-[var(--text-inverse)] hover:brightness-95 active:scale-[0.98]",
    icon: "bg-transparent hover:bg-[var(--surface-hover,var(--ws-panel))] text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-[0.98]",
    navigation: `${WORKSPACE.nav.item} justify-start`,
    cta: "bg-gradient-to-r from-[var(--brand-blue-400)] to-[var(--brand-blue-500)] text-[var(--text-inverse)] shadow-md hover:brightness-110 active:scale-[0.98]",
  };

  const sizes: Record<string, string> = {
    sm: "h-7.5 px-2.5 type-caption rounded-[6px] max-sm:min-h-10 max-sm:min-w-10",
    md: "h-8.5 px-3 py-1 type-ui rounded-[7px] max-sm:min-h-10 max-sm:min-w-10",
    lg: "h-9.5 px-4 text-sm font-semibold rounded-[8px] max-sm:min-h-11 max-sm:min-w-11",
    default: "h-8.5 px-3 py-1 type-ui rounded-[7px] max-sm:min-h-10 max-sm:min-w-10",
    icon: "h-8 w-8 p-0 rounded-[7px] max-sm:min-h-10 max-sm:min-w-10",
  };

  const visualVariant = variant === 'default' ? 'outline' : variant;
  return (
    <button ref={ref} type={type} disabled={isActuallyDisabled}
      aria-busy={isLoading || undefined} aria-disabled={isActuallyDisabled || undefined}
      className={`${baseStyles} ${variants[visualVariant]} ${sizes[size]} ${className}`} {...props}>
      {isLoading && <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin shrink-0" aria-hidden="true" />}
      {!isLoading && icon && <span className="flex items-center shrink-0" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
});
Button.displayName = 'Button';
