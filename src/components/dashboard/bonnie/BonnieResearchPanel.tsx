'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { ResearchBriefing, ResearchRecommendation } from '@/lib/bonnie/research/researchCatalog';

type BonnieResearchPanelProps = {
  tenantId: string;
};

const recommendationStyles: Record<ResearchRecommendation, string> = {
  adopt: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  integrate: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  watch: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  skip: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  replace: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export function BonnieResearchPanel({ tenantId }: BonnieResearchPanelProps) {
  const [briefing, setBriefing] = useState<ResearchBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bonnie/research?tenantId=${encodeURIComponent(tenantId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.briefing) throw new Error(data.error || 'Failed to load research');
      setBriefing(data.briefing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/bonnie/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.briefing) throw new Error(data.error || 'Refresh failed');
      setBriefing(data.briefing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-teal-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">Bonnie Research</h3>
            <p className="text-[11px] text-slate-500 truncate">
              Continuous OSS + architecture evaluation for the agentic OS
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Rescore
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[420px] overflow-y-auto">
        {loading ? (
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading research briefing…
          </p>
        ) : error ? (
          <p className="text-xs text-rose-400">{error}</p>
        ) : briefing ? (
          <>
            <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-teal-400 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Priority for AlphaClone
              </p>
              <ul className="space-y-1.5">
                {briefing.priorities.map((item) => (
                  <li key={item} className="text-xs text-slate-300 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              {briefing.findings.map((finding) => (
                <div
                  key={finding.targetId}
                  className="rounded-xl border border-white/5 bg-slate-950/50 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{finding.name}</p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${recommendationStyles[finding.recommendation]}`}
                    >
                      {finding.recommendation}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{finding.summary}</p>
                  <p className="text-[11px] text-slate-500">{finding.nextAction}</p>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-slate-600">
              Updated {new Date(briefing.generatedAt).toLocaleString()} · Never clone — extract and improve
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
