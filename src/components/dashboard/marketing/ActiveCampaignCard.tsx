'use client';

import React from 'react';
import Link from 'next/link';
import { Pause, Square, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ActiveCampaignData = {
  id: string;
  name: string;
  status: string;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  replied: number;
  progress: number;
  scheduledAt?: string | null;
  nextBatchAt?: string | null;
};

interface ActiveCampaignCardProps {
  campaign: ActiveCampaignData;
  onPause?: (id: string) => void;
  onStop?: (id: string) => void;
  compact?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Running',
  sending: 'Running',
  processing: 'Running',
  queued: 'Queued',
  scheduled: 'Scheduled',
};

function formatSchedule(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ActiveCampaignCard({ campaign, onPause, onStop, compact }: ActiveCampaignCardProps) {
  const statusLabel = STATUS_LABELS[campaign.status.toLowerCase()] || campaign.status;
  const isRunning = ['active', 'sending', 'processing'].includes(campaign.status.toLowerCase());
  const scheduleLabel = formatSchedule(campaign.scheduledAt);
  const nextBatch = formatSchedule(campaign.nextBatchAt);

  return (
    <div className="ac-workspace-panel p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-[var(--ws-text-primary)] truncate">{campaign.name}</h3>
          <span
            className={cn(
              'inline-flex mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded',
              isRunning
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : campaign.status === 'scheduled'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
            )}
          >
            {statusLabel}
          </span>
        </div>
        {campaign.total > 0 && (
          <span className="text-[12px] font-mono text-[var(--ws-text-secondary)] shrink-0">
            {campaign.processed} / {campaign.total}
          </span>
        )}
      </div>

      {campaign.total > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-[var(--ws-text-secondary)]">
            <span>{campaign.progress}% contacted</span>
            {nextBatch && isRunning ? <span>Next batch: {nextBatch}</span> : null}
            {scheduleLabel && campaign.status === 'scheduled' ? <span>{scheduleLabel}</span> : null}
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500/80 rounded-full transition-all"
              style={{ width: `${Math.min(100, campaign.progress)}%` }}
            />
          </div>
        </div>
      )}

      {!compact && (
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-[10px] text-[var(--ws-text-secondary)] uppercase">Sent</p>
            <p className="text-[13px] font-semibold text-[var(--ws-text-primary)]">{campaign.sent}</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--ws-text-secondary)] uppercase">Failed</p>
            <p className={cn('text-[13px] font-semibold', campaign.failed > 0 ? 'text-red-400' : 'text-[var(--ws-text-primary)]')}>
              {campaign.failed}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--ws-text-secondary)] uppercase">Replied</p>
            <p className={cn('text-[13px] font-semibold', campaign.replied > 0 ? 'text-emerald-400' : 'text-[var(--ws-text-primary)]')}>
              {campaign.replied}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--ws-text-secondary)] uppercase">Remaining</p>
            <p className="text-[13px] font-semibold text-[var(--ws-text-primary)]">
              {Math.max(0, campaign.total - campaign.processed)}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {isRunning && onPause ? (
          <button
            type="button"
            onClick={() => onPause(campaign.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide rounded border border-white/10 text-slate-300 hover:text-white hover:border-white/20 transition-colors"
          >
            <Pause className="w-3 h-3" />
            Pause
          </button>
        ) : null}
        <Link
          href={`/dashboard/business/campaigns?campaign=${campaign.id}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide rounded border border-teal-500/30 text-teal-300 hover:bg-teal-500/10 transition-colors"
        >
          <Eye className="w-3 h-3" />
          View
        </Link>
        {isRunning && onStop ? (
          <button
            type="button"
            onClick={() => onStop(campaign.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
          >
            <Square className="w-3 h-3" />
            Stop
          </button>
        ) : null}
      </div>
    </div>
  );
}
