'use client';

import React from 'react';
import { CheckCircle2, Circle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'disputed'
  | 'void'
  | 'cancelled';

interface PipelineStage {
  key: InvoiceStatus;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  isTerminal?: boolean;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    key: 'draft',
    label: 'Draft',
    shortLabel: 'Draft',
    description: 'Invoice created, not yet sent',
    icon: Clock,
    color: 'text-slate-400',
    bgColor: 'bg-slate-800',
    borderColor: 'border-slate-700',
  },
  {
    key: 'sent',
    label: 'Sent',
    shortLabel: 'Sent',
    description: 'Delivered to client email',
    icon: CheckCircle2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    key: 'viewed',
    label: 'Viewed',
    shortLabel: 'Viewed',
    description: 'Client opened the invoice',
    icon: CheckCircle2,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
  },
  {
    key: 'partially_paid',
    label: 'Partial',
    shortLabel: 'Partial',
    description: 'Deposit received',
    icon: CheckCircle2,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  {
    key: 'paid',
    label: 'Paid',
    shortLabel: 'Paid',
    description: 'Full payment confirmed',
    icon: CheckCircle2,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30',
  },
];

const TERMINAL_STAGES: PipelineStage[] = [
  {
    key: 'overdue',
    label: 'Overdue',
    shortLabel: 'OVD',
    description: 'Past due date, not paid',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    isTerminal: true,
  },
  {
    key: 'disputed',
    label: 'Disputed',
    shortLabel: 'DSP',
    description: 'Client flagged an issue',
    icon: AlertTriangle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    isTerminal: true,
  },
  {
    key: 'void',
    label: 'Void',
    shortLabel: 'VOID',
    description: 'Cancelled / written off',
    icon: XCircle,
    color: 'text-slate-500',
    bgColor: 'bg-slate-900',
    borderColor: 'border-slate-800',
    isTerminal: true,
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    shortLabel: 'CXL',
    description: 'Cancelled',
    icon: XCircle,
    color: 'text-slate-500',
    bgColor: 'bg-slate-900',
    borderColor: 'border-slate-800',
    isTerminal: true,
  },
];

const STATUS_ORDER: InvoiceStatus[] = [
  'draft', 'sent', 'viewed', 'partially_paid', 'paid',
];

interface InvoiceStatusPipelineProps {
  status: InvoiceStatus;
  timestamps?: {
    created_at?: string;
    sent_at?: string;
    viewed_at?: string;
    partially_paid_at?: string;
    paid_at?: string;
    disputed_at?: string;
  };
  compact?: boolean;
  className?: string;
}

function formatTime(ts?: string): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return '';
  }
}

const TIMESTAMP_MAP: Record<InvoiceStatus, keyof NonNullable<InvoiceStatusPipelineProps['timestamps']>> = {
  draft: 'created_at',
  sent: 'sent_at',
  viewed: 'viewed_at',
  partially_paid: 'partially_paid_at',
  paid: 'paid_at',
  overdue: 'sent_at',
  disputed: 'disputed_at',
  void: 'sent_at',
  cancelled: 'sent_at',
};

export default function InvoiceStatusPipeline({
  status,
  timestamps,
  compact = false,
  className,
}: InvoiceStatusPipelineProps) {
  const terminalStage = TERMINAL_STAGES.find((s) => s.key === status);
  const currentIndex = STATUS_ORDER.indexOf(status);

  if (compact) {
    // Compact badge mode
    const allStages = [...PIPELINE_STAGES, ...TERMINAL_STAGES];
    const stage = allStages.find((s) => s.key === status) ?? PIPELINE_STAGES[0];
    const Icon = stage.icon;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border',
          stage.bgColor,
          stage.color,
          stage.borderColor,
          className
        )}
      >
        <Icon className="w-3 h-3" />
        {stage.label}
      </span>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Terminal state overlay */}
      {terminalStage && (
        <div className={cn(
          'mb-4 px-4 py-3 rounded-xl border flex items-center gap-3',
          terminalStage.bgColor,
          terminalStage.borderColor
        )}>
          <terminalStage.icon className={cn('w-5 h-5 flex-shrink-0', terminalStage.color)} />
          <div>
            <p className={cn('font-bold text-sm', terminalStage.color)}>{terminalStage.label}</p>
            <p className="text-xs text-slate-500">{terminalStage.description}</p>
          </div>
        </div>
      )}

      {/* Main pipeline */}
      <div className="flex items-start gap-0 w-full overflow-x-auto pb-1">
        {PIPELINE_STAGES.map((stage, idx) => {
          const isCompleted = currentIndex >= idx && !terminalStage;
          const isActive = currentIndex === idx && !terminalStage;
          const isFuture = currentIndex < idx || !!terminalStage;
          const ts = timestamps?.[TIMESTAMP_MAP[stage.key]];
          const Icon = stage.icon;

          return (
            <React.Fragment key={stage.key}>
              {/* Stage node */}
              <div className="flex flex-col items-center min-w-[72px] flex-1">
                <div
                  className={cn(
                    'w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all',
                    isCompleted
                      ? cn(stage.bgColor, stage.borderColor)
                      : isActive
                      ? cn(stage.bgColor, stage.borderColor, 'ring-2 ring-offset-2 ring-offset-slate-950 ring-current')
                      : 'bg-slate-900 border-slate-800'
                  )}
                >
                  {isCompleted || isActive ? (
                    <Icon className={cn('w-4 h-4', stage.color)} />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-700" />
                  )}
                </div>
                <p className={cn(
                  'text-[10px] font-bold uppercase tracking-wide mt-1.5 text-center',
                  isCompleted || isActive ? stage.color : 'text-slate-700'
                )}>
                  {stage.shortLabel}
                </p>
                {ts && (isCompleted || isActive) && (
                  <p className="text-[9px] text-slate-600 mt-0.5 text-center whitespace-nowrap">
                    {formatTime(ts)}
                  </p>
                )}
              </div>

              {/* Connector line */}
              {idx < PIPELINE_STAGES.length - 1 && (
                <div className={cn(
                  'h-0.5 flex-1 mt-[18px] mx-1 rounded-full transition-colors',
                  isCompleted && currentIndex > idx && !terminalStage
                    ? 'bg-teal-500/40'
                    : 'bg-slate-800'
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
