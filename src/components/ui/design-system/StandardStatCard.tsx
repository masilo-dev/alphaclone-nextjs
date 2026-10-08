'use client';

import React from 'react';
import { ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * CardTheme — maps to MODULE_IDENTITY and SEMANTIC palette.
 * Colors are sourced from CSS custom properties (no raw hex).
 * Themes are designed for both dark and light workspace modes.
 */
export type CardTheme =
  | 'teal'
  | 'blue'
  | 'purple'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'orange'
  | 'indigo';

/**
 * Maps CardTheme to CSS custom property references.
 * All values resolve through the semantic token layer —
 * no neon hex, no hardcoded colors, no glassmorphism.
 */
const THEME_TOKENS: Record<CardTheme, {
  accentVar: string;   // CSS variable for the accent color
  iconBg: string;      // Tailwind class for icon background (uses color-mix via inline style)
  textClass: string;   // Tailwind token for accent text
}> = {
  teal:    { accentVar: 'var(--interactive-secondary)',  iconBg: 'bg-[var(--info-surface)]',             textClass: 'text-[var(--interactive-secondary)]' },
  blue:    { accentVar: 'var(--ac-accent)',              iconBg: 'bg-[var(--ac-accent-muted)]',          textClass: 'text-[var(--ac-accent)]' },
  purple:  { accentVar: 'var(--brand-violet-500)',       iconBg: 'bg-[var(--brand-violet-500)]/10',      textClass: 'text-[var(--brand-violet-500)]' },
  emerald: { accentVar: 'var(--success-500)',            iconBg: 'bg-[var(--success-surface)]',          textClass: 'text-[var(--success-text)]' },
  amber:   { accentVar: 'var(--warning-500)',            iconBg: 'bg-[var(--warning-surface)]',          textClass: 'text-[var(--warning-text)]' },
  rose:    { accentVar: 'var(--error-500)',              iconBg: 'bg-[var(--error-surface)]',            textClass: 'text-[var(--error-text)]' },
  sky:     { accentVar: 'var(--info-500)',               iconBg: 'bg-[var(--info-surface)]',             textClass: 'text-[var(--info-text)]' },
  orange:  { accentVar: 'var(--warning-600)',            iconBg: 'bg-[var(--warning-surface)]',          textClass: 'text-[var(--warning-text)]' },
  indigo:  { accentVar: 'var(--brand-violet-400)',       iconBg: 'bg-[var(--brand-violet-500)]/10',     textClass: 'text-[var(--brand-violet-500)]' },
};

interface StandardStatCardProps {
  label: string;
  value: string | number;
  delta?: number | string;
  deltaDir?: 'up' | 'down' | 'none';
  comparisonText?: string;
  icon?: React.ElementType | React.ReactNode;
  themeColor?: CardTheme;
  onClick?: () => void;
  className?: string;
  /** @deprecated — all cards are now non-floating. Kept for API compatibility. */
  interactive?: boolean;
}

export function StandardStatCard({
  label,
  value,
  delta,
  deltaDir,
  comparisonText = 'vs last month',
  icon,
  themeColor = 'teal',
  onClick,
  className,
}: StandardStatCardProps) {
  const theme = THEME_TOKENS[themeColor] ?? THEME_TOKENS.teal;
  const isClickable = Boolean(onClick);

  // Resolve delta direction and display text
  let resolvedDeltaDir: 'up' | 'down' | 'none' = 'none';
  let deltaText = '';

  if (delta !== undefined) {
    if (typeof delta === 'number') {
      resolvedDeltaDir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'none';
      deltaText = `${delta > 0 ? '+' : ''}${delta}%`;
    } else {
      deltaText = delta;
      if (deltaDir) {
        resolvedDeltaDir = deltaDir;
      } else {
        resolvedDeltaDir = delta.startsWith('+') ? 'up' : delta.startsWith('-') ? 'down' : 'none';
      }
    }
  }

  const content = (
    <div className="flex flex-col h-full justify-between">
      {/* Top: label + value + icon */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-0.5 min-w-0">
          <p className="type-caption font-semibold uppercase tracking-label text-[var(--ws-text-tertiary)] truncate">
            {label}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-[var(--ws-text-primary)] tracking-tight leading-none mt-1 tabular-nums">
            {value}
          </p>
        </div>

        {icon && (
          <span
            className={cn(
              'w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-[8px] flex items-center justify-center border border-[var(--ws-border)] shrink-0',
              theme.iconBg,
              theme.textClass
            )}
          >
            {React.isValidElement(icon)
              ? icon
              : React.createElement(icon as React.ElementType, { className: 'w-3.5 h-3.5 sm:w-4 sm:h-4' })}
          </span>
        )}
      </div>

      {/* Bottom: delta badge + comparison text */}
      <div className="mt-2.5 pt-2 border-t border-[var(--ws-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {delta !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded type-caption font-semibold tabular-nums',
                resolvedDeltaDir === 'up'   && 'bg-[var(--success-surface)] text-[var(--success-text)]',
                resolvedDeltaDir === 'down' && 'bg-[var(--error-surface)] text-[var(--error-text)]',
                resolvedDeltaDir === 'none' && 'bg-[var(--ws-hover)] text-[var(--ws-text-muted)]'
              )}
            >
              {resolvedDeltaDir === 'up'   && <TrendingUp className="w-3 h-3" />}
              {resolvedDeltaDir === 'down' && <TrendingDown className="w-3 h-3" />}
              {deltaText}
            </span>
          )}
          <span className="type-caption text-[var(--ws-text-muted)] truncate">{comparisonText}</span>
        </div>

        {isClickable && (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--ws-text-tertiary)] shrink-0" />
        )}
      </div>
    </div>
  );

  const cardClasses = cn(
    // Use the standard OS panel class — provides surface + border via CSS
    'ac-workspace-panel',
    'relative text-left w-full p-3 sm:p-3.5 rounded-[10px] sm:rounded-xl transition-colors duration-200',
    isClickable && 'cursor-pointer hover:border-[var(--ws-border-strong)]',
    className
  );

  if (!isClickable) {
    return <div className={cardClasses}>{content}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={cardClasses}>
      {content}
    </button>
  );
}

export default StandardStatCard;
