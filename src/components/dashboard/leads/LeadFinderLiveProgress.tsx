'use client';

import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Loader2, MapPin, Radar } from 'lucide-react';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';

type RunStatus = {
  status?: string;
  progress?: number;
  current_step?: string;
  source_count?: number;
  enriched_count?: number;
  mode?: string;
};

type Props = {
  campaignId: string | null;
  searching: boolean;
  niche?: string;
  location?: string;
  radiusKm?: number;
  onCompleted?: () => void;
};

const STEP_HINTS = [
  'Geocoding location (Nominatim / Photon)',
  'Scraping OpenStreetMap Overpass',
  'Querying Wikidata organizations',
  'Merging free directory fallbacks',
  'Ranking by reach distance',
];

export default function LeadFinderLiveProgress({
  campaignId,
  searching,
  niche,
  location,
  radiusKm = 25,
  onCompleted,
}: Props) {
  const tenant = useCurrentTenantSafe();
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [hintIdx, setHintIdx] = useState(0);

  useEffect(() => {
    if (!searching) return;
    const t = setInterval(() => setHintIdx((i) => (i + 1) % STEP_HINTS.length), 2200);
    return () => clearInterval(t);
  }, [searching]);

  useEffect(() => {
    if (!tenant?.id || !campaignId) return;
    let cancelled = false;
    let done = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/scraper-campaigns/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: tenant.id,
            action: 'status',
            campaignId,
          }),
        });
        const data = await res.json();
        if (!res.ok || cancelled) return;
        const next = (data.status || {}) as RunStatus;
        setStatus(next);
        if (!done && (next.status === 'completed' || (next.progress ?? 0) >= 100)) {
          done = true;
          onCompleted?.();
        }
      } catch {
        // ignore transient poll errors
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), searching ? 1500 : 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tenant?.id, campaignId, searching, onCompleted]);

  if (!searching && !campaignId) return null;

  const progress = Math.min(100, Math.max(0, status?.progress ?? (searching ? 12 : 0)));
  const complete = status?.status === 'completed' || progress >= 100;

  return (
    <div className="rounded-xl border border-teal-500/30 bg-slate-950/80 overflow-hidden">
      <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-slate-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            {complete ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Radar className="w-4 h-4 text-teal-400 animate-pulse shrink-0" />
            )}
            {complete ? 'Scrape complete' : 'Live scrape running'}
          </div>
          <p className="text-xs text-slate-400 mt-1 truncate">
            {niche || 'Businesses'}
            {location ? ` · ${location}` : ''}
            {` · ${radiusKm} km reach`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold tabular-nums text-teal-300">{progress}%</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            {status?.mode || 'in-process'}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300">
          {searching && !complete ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
          ) : (
            <Activity className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span className="truncate">
            {status?.current_step || STEP_HINTS[hintIdx]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2">
            <div className="text-slate-500">Discovered</div>
            <div className="text-white font-semibold tabular-nums">
              {status?.source_count ?? 0}
            </div>
          </div>
          <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2">
            <div className="text-slate-500">With contact</div>
            <div className="text-white font-semibold tabular-nums">
              {status?.enriched_count ?? 0}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
          <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-teal-500" />
          Free sources only: OpenStreetMap Overpass, Nominatim/Photon geocoding, Wikidata, DuckDuckGo, Foursquare free tier.
        </p>
      </div>
    </div>
  );
}
