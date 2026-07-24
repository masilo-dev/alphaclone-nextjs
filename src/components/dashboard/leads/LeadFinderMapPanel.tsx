'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import type { LeadMapPin } from '@/components/leads/LeadMapView';

const LeadMapView = dynamic(() => import('@/components/leads/LeadMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] md:h-[420px] rounded-xl border border-slate-700 bg-slate-950 flex items-center justify-center text-slate-500 text-sm">
      Loading map…
    </div>
  ),
});

type Props = {
  leads: LeadMapPin[];
  previewCenter?: [number, number] | null;
  previewRadiusKm?: number;
  emptyHint?: string;
};

export default function LeadFinderMapPanel({
  leads,
  previewCenter = null,
  previewRadiusKm = 25,
  emptyHint = 'Run a search to plot free geo leads on the map.',
}: Props) {
  const pinned = leads.filter((l) => l.lat != null && l.lng != null);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">Reach map</p>
            <p className="text-[11px] text-slate-500 truncate">
              {pinned.length} pinned · OSM tiles · free geodata
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">
          {previewRadiusKm} km
        </span>
      </div>

      {pinned.length === 0 ? (
        <div className="h-[280px] md:h-[360px] flex flex-col items-center justify-center gap-2 px-6 text-center bg-[radial-gradient(circle_at_30%_20%,rgba(20,184,166,0.12),transparent_55%)]">
          <MapPin className="w-8 h-8 text-slate-600" />
          <p className="text-sm text-slate-400">{emptyHint}</p>
        </div>
      ) : (
        <LeadMapView
          leads={leads}
          previewCenter={previewCenter}
          previewRadiusKm={previewRadiusKm}
        />
      )}
    </div>
  );
}
