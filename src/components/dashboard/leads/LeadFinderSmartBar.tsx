'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Brain,
  Loader2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { LeadFinderProfile } from '@/lib/scraper/leadFinderLearning';
import type { ParsedLeadIntent } from '@/lib/scraper/parseLeadIntent';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';

type Props = {
  onProfileLoaded?: (profile: LeadFinderProfile, intent: ParsedLeadIntent | null) => void;
  onSmartSearch?: (intent: ParsedLeadIntent) => void;
  searching?: boolean;
};

export default function LeadFinderSmartBar({ onProfileLoaded, onSmartSearch, searching }: Props) {
  const tenant = useCurrentTenantSafe();
  const [profile, setProfile] = useState<LeadFinderProfile | null>(null);
  const [intent, setIntent] = useState<ParsedLeadIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const onProfileLoadedRef = useRef(onProfileLoaded);
  onProfileLoadedRef.current = onProfileLoaded;

  const load = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/scraper-campaigns/learn?tenantId=${encodeURIComponent(tenant.id)}`);
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        setIntent(data.intent ?? null);
        onProfileLoadedRef.current?.(data.profile, data.intent ?? null);
      }
    } catch {
      // optional panel
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading your prospecting profile…
      </div>
    );
  }

  if (!profile) return null;

  const canAutoSearch = Boolean(intent?.niche?.trim());

  return (
    <div className="rounded-lg border border-teal-500/20 bg-gradient-to-r from-slate-900/80 to-teal-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-teal-500/10 shrink-0">
          <Brain className="w-4 h-4 text-teal-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-200 font-medium">Smart prospecting</p>
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
            {profile.learnedMessage.replace(/\*\*/g, '')}
          </p>
          {profile.totalSearches > 0 && (
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {profile.totalSearches} searches · {profile.totalLeadsFound} leads found
            </p>
          )}
        </div>
      </div>
      {canAutoSearch && onSmartSearch && intent && (
        <button
          type="button"
          disabled={searching}
          onClick={() => onSmartSearch(intent)}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-medium"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Find leads for me
        </button>
      )}
    </div>
  );
}
