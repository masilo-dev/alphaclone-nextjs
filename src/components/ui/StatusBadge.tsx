'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type StatusBadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'neutral'
  | 'info'
  | 'draft'
  | 'pending';

const VARIANTS: Record<StatusBadgeVariant, string> = {
  success: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  error: 'bg-red-500/15 text-red-300 border-red-500/30',
  neutral: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  info: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  draft: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  pending: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
};

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: StatusBadgeVariant;
  className?: string;
}

/** Pill status indicator — full text, never truncated (enterprise pattern). */
export function StatusBadge({ children, variant = 'neutral', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap capitalize',
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function invoiceStatusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'paid':
      return 'success';
    case 'sent':
      return 'info';
    case 'overdue':
      return 'error';
    case 'draft':
      return 'draft';
    default:
      return 'neutral';
  }
}

export function quoteStatusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'accepted':
    case 'converted':
      return 'success';
    case 'sent':
      return 'info';
    case 'rejected':
    case 'expired':
      return 'error';
    case 'draft':
      return 'draft';
    default:
      return 'neutral';
  }
}

export function inboxStatusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'new':
      return 'info';
    case 'read':
      return 'pending';
    case 'replied':
      return 'success';
    default:
      return 'neutral';
  }
}

export function dealStatusVariant(stage: string): StatusBadgeVariant {
  switch (stage) {
    case 'closed_won':
      return 'success';
    case 'closed_lost':
      return 'error';
    case 'proposal':
    case 'negotiation':
      return 'warning';
    case 'qualified':
      return 'info';
    default:
      return 'neutral';
  }
}

export function expenseStatusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'approved':
      return 'success';
    case 'pending':
      return 'pending';
    case 'rejected':
      return 'error';
    default:
      return 'neutral';
  }
}

export function ticketStatusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'resolved':
    case 'closed':
      return 'success';
    case 'in_progress':
    case 'reopened':
      return 'warning';
    case 'open':
      return 'info';
    default:
      return 'neutral';
  }
}

export function userStatusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'active':
      return 'success';
    case 'suspended':
      return 'error';
    default:
      return 'neutral';
  }
}
