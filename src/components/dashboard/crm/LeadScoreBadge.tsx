'use client';

import React from 'react';
import { Zap } from 'lucide-react';

interface LeadScoreBadgeProps {
  contact: {
    email?: string;
    phone?: string;
    company?: { name: string } | null;
    status?: string;
    tags?: string[];
  };
  hasDeal?: boolean;
  dealStage?: string;
  size?: 'sm' | 'md';
}

const ADVANCED_STAGES = new Set(['proposal', 'negotiation', 'closed_won']);

export function computeLeadScore(contact: LeadScoreBadgeProps['contact'], hasDeal = false, dealStage = ''): number {
  let score = 0;
  if (contact.email) score += 20;
  if (contact.phone) score += 15;
  if (contact.company?.name) score += 10;
  if (contact.status === 'active') score += 10;
  if (contact.tags && contact.tags.length > 0) score += 5;
  if (hasDeal) score += 25;
  if (hasDeal && ADVANCED_STAGES.has(dealStage)) score += 15;
  return Math.min(100, score);
}

export function LeadScoreBadge({ contact, hasDeal = false, dealStage = '', size = 'sm' }: LeadScoreBadgeProps) {
  const score = computeLeadScore(contact, hasDeal, dealStage);

  const { color, bg, label } = score >= 75
    ? { color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', label: 'Hot' }
    : score >= 50
    ? { color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30', label: 'Warm' }
    : score >= 25
    ? { color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30', label: 'Cool' }
    : { color: 'text-slate-400', bg: 'bg-white/5 border-white/10', label: 'Cold' };

  if (size === 'sm') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-black ${bg} ${color}`}
        title={`Lead Score: ${score}/100 (${label})`}
      >
        <Zap size={9} />
        {score}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black ${bg} ${color}`}>
      <Zap size={12} />
      <span>Score {score}</span>
      <span className="opacity-70">· {label}</span>
    </div>
  );
}
