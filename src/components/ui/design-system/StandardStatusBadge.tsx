'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'success'   // teal / green
  | 'warning'   // amber / orange
  | 'error'     // red
  | 'info'      // blue / sky
  | 'neutral'   // slate
  | 'purple'    // indigo / purple
  | 'high'      // red gradient border
  | 'medium'    // amber gradient border
  | 'low';      // emerald gradient border

/**
 * Map design-system BadgeVariant to app-scoped semantic severity surfaces.
 * Using scoped severity classes (ac-sev-*) ensures badges automatically
 * respect light/dark theme tokens instead of hardcoded Tailwind colors.
 */
const VARIANT_MAP: Record<BadgeVariant, string> = {
  // Scoped semantic severity — theme-token aware
  success: 'ac-sev-success',
  warning: 'ac-sev-warning',
  error: 'ac-sev-error',
  info: 'ac-sev-info',
  neutral:
    'bg-[var(--ws-surface-secondary)] border-[var(--ws-border-strong)] text-[var(--ws-text-secondary)]',
  purple:
    'bg-[color-mix(in_srgb,var(--brand-violet-500)_14%,var(--ws-surface-primary))] border-[color-mix(in_srgb,var(--brand-violet-500)_30%,var(--ws-border))] text-[color-mix(in_srgb,var(--brand-violet-400)_90%,var(--ws-text-primary))]',

  // Priority styles (used for ticket / deal / task priority) — same severity semantics
  high: 'ac-sev-error shadow-[0_0_10px_rgba(239,68,68,0.1)]',
  medium: 'ac-sev-warning shadow-[0_0_10px_rgba(245,158,11,0.1)]',
  low: 'ac-sev-success shadow-[0_0_10px_rgba(16,185,129,0.1)]',
};

interface StandardStatusBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  /** Optional screen-reader-only label (useful when the visual text is a terse abbreviation). */
  'aria-label'?: string;
}

export function StandardStatusBadge({
  children,
  variant = 'neutral',
  className,
  'aria-label': ariaLabel,
}: StandardStatusBadgeProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border whitespace-nowrap select-none transition-all duration-300',
        VARIANT_MAP[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Maps standard platform statuses/stages to design tokens
export function resolveStatusVariant(status: string): BadgeVariant {
  const norm = status?.toLowerCase()?.trim()?.replace(/_/g, ' ') || '';
  
  // Success / Won
  if (['paid', 'success', 'active', 'closed won', 'resolved', 'closed', 'completed', 'approved', 'accepted', 'converted'].includes(norm)) {
    return 'success';
  }
  
  // Warning / In progress
  if (['pending', 'warning', 'in progress', 'reopened', 'proposal', 'negotiation', 'sent', 'scheduled'].includes(norm)) {
    return 'warning';
  }
  
  // Error / Cancelled / Lost
  if (['overdue', 'error', 'failed', 'closed lost', 'rejected', 'expired', 'suspended', 'cancelled', 'high'].includes(norm)) {
    return 'error';
  }
  
  // Info / New
  if (['info', 'new', 'qualified', 'contacted', 'lead', 'draft'].includes(norm)) {
    return 'info';
  }

  // Priority mapping
  if (norm === 'medium') return 'medium';
  if (norm === 'low') return 'low';
  
  return 'neutral';
}
