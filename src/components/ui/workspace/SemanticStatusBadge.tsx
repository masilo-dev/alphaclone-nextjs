'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { semanticStatusFor, type SemanticStatus } from '@/lib/ui/statusSemantics';
import { CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw, Circle } from 'lucide-react';

export interface SemanticStatusBadgeProps {
  /** The business domain status (e.g. 'Draft', 'Sent', 'Overdue', 'Paid', 'Published') */
  status: string;
  /** Optional custom display label (defaults to formatted status) */
  label?: string;
  /** Optional execution/provider verification status (e.g. 'Email delivered', 'Provider accepted', 'Queued') */
  executionStatus?: string;
  /** Force explicit semantic tone or let it auto-resolve from status string */
  semanticTone?: SemanticStatus;
  /** Density size */
  size?: 'compact' | 'standard';
  className?: string;
  showIcon?: boolean;
}

const TONE_STYLES: Record<SemanticStatus, { badge: string; dot: string; iconColor: string }> = {
  success: {
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-400',
    iconColor: 'text-emerald-400',
  },
  active: {
    badge: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
    dot: 'bg-teal-400',
    iconColor: 'text-teal-400',
  },
  running: {
    badge: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    dot: 'bg-sky-400',
    iconColor: 'text-sky-400',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    dot: 'bg-amber-400',
    iconColor: 'text-amber-400',
  },
  danger: {
    badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    dot: 'bg-rose-400',
    iconColor: 'text-rose-400',
  },
  blocked: {
    badge: 'bg-red-500/10 text-red-300 border-red-500/20',
    dot: 'bg-red-500',
    iconColor: 'text-red-400',
  },
  neutral: {
    badge: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    dot: 'bg-slate-400',
    iconColor: 'text-slate-400',
  },
};

export function SemanticStatusBadge({
  status,
  label,
  executionStatus,
  semanticTone,
  size = 'standard',
  className,
  showIcon = true,
}: SemanticStatusBadgeProps) {
  const tone = semanticTone || semanticStatusFor(status);
  const styles = TONE_STYLES[tone] || TONE_STYLES.neutral;
  const displayLabel = label || status.replace(/_/g, ' ');

  const renderIcon = () => {
    switch (tone) {
      case 'success':
        return <CheckCircle2 className={cn('shrink-0', size === 'compact' ? 'w-3 h-3' : 'w-3.5 h-3.5', styles.iconColor)} />;
      case 'running':
        return <RefreshCw className={cn('shrink-0 animate-spin', size === 'compact' ? 'w-3 h-3' : 'w-3.5 h-3.5', styles.iconColor)} />;
      case 'warning':
        return <Clock className={cn('shrink-0', size === 'compact' ? 'w-3 h-3' : 'w-3.5 h-3.5', styles.iconColor)} />;
      case 'danger':
      case 'blocked':
        return <AlertTriangle className={cn('shrink-0', size === 'compact' ? 'w-3 h-3' : 'w-3.5 h-3.5', styles.iconColor)} />;
      default:
        return <span className={cn('rounded-full shrink-0', size === 'compact' ? 'w-1.5 h-1.5' : 'w-2 h-2', styles.dot)} />;
    }
  };

  return (
    <div className={cn('inline-flex items-center gap-1.5 flex-wrap', className)}>
      {/* Primary Business Status */}
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border font-medium capitalize select-none transition-colors',
          size === 'compact' ? 'px-2 py-0.5 text-xs leading-none' : 'px-2.5 py-1 text-xs leading-tight',
          styles.badge
        )}
      >
        {showIcon ? renderIcon() : null}
        <span>{displayLabel}</span>
      </span>

      {/* Secondary Execution / Provider Verification Status */}
      {executionStatus ? (
        <span
          title={`Execution status: ${executionStatus}`}
          className={cn(
            'inline-flex items-center gap-1 text-[11px] font-mono tracking-tight text-[var(--ws-text-muted)] bg-[var(--ws-panel)] px-1.5 py-0.5 rounded border border-[var(--ws-border)]'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
          <span className="truncate max-w-[140px]">{executionStatus}</span>
        </span>
      ) : null}
    </div>
  );
}

export default SemanticStatusBadge;
