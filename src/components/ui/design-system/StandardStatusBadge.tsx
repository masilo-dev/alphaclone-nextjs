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

const VARIANT_MAP: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  neutral: 'bg-slate-800/50 text-slate-400 border-slate-700/30',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  
  // Custom Priority styles with micro-glows/borders
  high: 'bg-red-950/20 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
  medium: 'bg-amber-950/20 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
  low: 'bg-emerald-950/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
};

interface StandardStatusBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function StandardStatusBadge({
  children,
  variant = 'neutral',
  className,
}: StandardStatusBadgeProps) {
  return (
    <span
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
