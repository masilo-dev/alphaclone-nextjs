'use client';

/**
 * StatusBadge — backward-compatible wrapper over the new unified design system.
 *
 * All variant helpers (invoiceStatusVariant, dealStatusVariant, etc.) are
 * preserved so existing callers don't need to change. Internally the rendering
 * now delegates to StandardStatusBadge for visual consistency.
 */

import React from 'react';
import { StandardStatusBadge, type BadgeVariant } from '@/components/ui/design-system';

export type StatusBadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'neutral'
  | 'info'
  | 'draft'
  | 'pending';

/** Map legacy variant names to the design-system BadgeVariant names. */
const LEGACY_TO_DS: Record<StatusBadgeVariant, BadgeVariant> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  neutral: 'neutral',
  info: 'info',
  draft: 'neutral',
  pending: 'warning',
};

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: StatusBadgeVariant;
  className?: string;
}

/** Pill status indicator — full text, never truncated (enterprise pattern). */
export function StatusBadge({ children, variant = 'neutral', className }: StatusBadgeProps) {
  return (
    <StandardStatusBadge variant={LEGACY_TO_DS[variant]} className={className}>
      {children}
    </StandardStatusBadge>
  );
}

// ── Variant helpers (unchanged API) ──────────────────────────────────────────

export function invoiceStatusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'paid': return 'success';
    case 'sent': return 'info';
    case 'overdue': return 'error';
    case 'draft': return 'draft';
    default: return 'neutral';
  }
}

export function quoteStatusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'accepted':
    case 'converted': return 'success';
    case 'sent': return 'info';
    case 'rejected':
    case 'expired': return 'error';
    case 'draft': return 'draft';
    default: return 'neutral';
  }
}

export function inboxStatusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'new': return 'info';
    case 'read': return 'pending';
    case 'replied': return 'success';
    default: return 'neutral';
  }
}

export function dealStatusVariant(stage: string): StatusBadgeVariant {
  switch (stage) {
    case 'closed_won': return 'success';
    case 'closed_lost': return 'error';
    case 'proposal':
    case 'negotiation': return 'warning';
    case 'qualified': return 'info';
    default: return 'neutral';
  }
}

export function expenseStatusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'approved': return 'success';
    case 'pending': return 'pending';
    case 'rejected': return 'error';
    default: return 'neutral';
  }
}

export function ticketStatusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'resolved':
    case 'closed': return 'success';
    case 'in_progress':
    case 'reopened': return 'warning';
    case 'open': return 'info';
    default: return 'neutral';
  }
}

export function ticketPriorityVariant(priority: string): StatusBadgeVariant {
  switch (priority) {
    case 'urgent':
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'neutral';
    default: return 'neutral';
  }
}

export function userStatusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'active': return 'success';
    case 'suspended': return 'error';
    default: return 'neutral';
  }
}
