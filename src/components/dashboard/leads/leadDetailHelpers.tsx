import React from 'react';
import { Calendar, DollarSign, Search, Send, Target, Zap } from 'lucide-react';
import type { Lead } from '@/services/leadService';

export function calculateLeadScore(lead: Lead): number {
  let score = 0;
  if (lead.email) score += 15;
  if (lead.phone) score += 15;
  if (lead.website) score += 10;
  if (lead.industry) score += 10;
  if (lead.location) score += 10;
  if (lead.value && lead.value > 0) score += 10;
  if (lead.techStack && lead.techStack.length > 0) score += 10;
  if (lead.painPoints && lead.painPoints.length > 0) score += 10;
  if (lead.isVerified) score += 10;
  return Math.min(100, score);
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

export function getVerificationStatus(lead: Lead): { label: string; className: string } | null {
  const quality = lead.metadata?.verification?.data_quality as string | undefined;
  if (quality === 'verified') {
    return { label: 'Verified', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  }
  if (quality === 'partial') {
    return { label: 'Partial', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  }
  if (quality === 'unverified') {
    return { label: 'Unverified', className: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
  }
  if (lead.isVerified) {
    return { label: 'Verified', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  }
  return null;
}

export function getStageBadge(stage: string): React.ReactNode {
  const stages: Record<string, { color: string; label: string }> = {
    lead: { color: 'bg-slate-500/20 text-slate-400', label: 'Lead' },
    qualified: { color: 'bg-blue-500/20 text-blue-400', label: 'Qualified' },
    proposal: { color: 'bg-purple-500/20 text-purple-400', label: 'Proposal' },
    negotiation: { color: 'bg-orange-500/20 text-orange-400', label: 'Negotiation' },
    won: { color: 'bg-green-500/20 text-green-400', label: 'Won' },
    lost: { color: 'bg-red-500/20 text-red-400', label: 'Lost' },
    converted: { color: 'bg-teal-500/20 text-teal-400', label: 'Converted' },
  };
  const stageInfo = stages[stage] || stages.lead;
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${stageInfo.color}`}>
      {stageInfo.label}
    </span>
  );
}

export function getNextBestAction(lead: Lead): {
  action: string;
  icon: React.ReactNode;
  color: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
} {
  const score = calculateLeadScore(lead);

  if (!lead.email && !lead.phone) {
    return {
      action: 'Find Contact Info',
      icon: <Search className="w-4 h-4" />,
      color: 'text-yellow-400',
      reason: 'Missing contact details — use Email Discovery',
      priority: 'high',
    };
  }

  if (lead.stage === 'lead' && score >= 60) {
    return {
      action: 'Qualify Lead',
      icon: <Target className="w-4 h-4" />,
      color: 'text-blue-400',
      reason: 'High score — ready to qualify and move to CRM',
      priority: 'high',
    };
  }

  if (lead.stage === 'qualified' && lead.email) {
    return {
      action: 'Send Outreach Email',
      icon: <Send className="w-4 h-4" />,
      color: 'text-green-400',
      reason: 'Qualified with email — start conversation',
      priority: 'high',
    };
  }

  if (lead.stage === 'proposal' && !lead.value) {
    return {
      action: 'Add Value Estimate',
      icon: <DollarSign className="w-4 h-4" />,
      color: 'text-purple-400',
      reason: 'Need deal value for proposal stage',
      priority: 'medium',
    };
  }

  if (score < 40) {
    return {
      action: 'Enrich Data',
      icon: <Zap className="w-4 h-4" />,
      color: 'text-orange-400',
      reason: 'Low score — gather more intelligence first',
      priority: 'medium',
    };
  }

  return {
    action: 'Schedule Follow-up',
    icon: <Calendar className="w-4 h-4" />,
    color: 'text-slate-400',
    reason: 'Keep momentum — schedule next touchpoint',
    priority: 'low',
  };
}
