'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Loader2, MapPin, Radar, Search, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';
import type { LeadFinderProfile } from '@/lib/scraper/leadFinderLearning';
import type { ParsedLeadIntent } from '@/lib/scraper/parseLeadIntent';
import ScraperLeadsTable, { type ScraperLead } from './ScraperLeadsTable';
import LeadFinderSystemPanel from './LeadFinderSystemPanel';
import LeadFinderSmartBar from './LeadFinderSmartBar';
import LeadFinderBeginnerGuide from './LeadFinderBeginnerGuide';
import LeadFinderLiveProgress from './LeadFinderLiveProgress';
import LeadFinderMapPanel from './LeadFinderMapPanel';

type Props = {
  onActivity?: () => void;
};

const RADIUS_OPTIONS = [5, 10, 15, 25, 40, 60];

export default function LeadFinderProspectsView({ onActivity }: Props) {
  const tenant = useCurrentTenantSafe();
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [radiusKm, setRadiusKm] = useState(25);
  const [hasEmail, setHasEmail] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [mapLeads, setMapLeads] = useState<ScraperLead[]>([]);

  const mapPins = useMemo(
    () =>
      mapLeads.map((l) => ({
        business_name: l.company || l.name || 'Lead',
        address: l.address,
        phone: l.phone,
        website: l.company_website || l.source_url,
        category: l.industry,
        source: l.source,
        lat: l.lat ?? undefined,
        lng: l.lng ?? undefined,
      })),
    [mapLeads]
  );

  const previewCenter = useMemo((): [number, number] | null => {
    const withGeo = mapLeads.find((l) => l.lat != null && l.lng != null);
    if (!withGeo || withGeo.lat == null || withGeo.lng == null) return null;
    // Prefer search center from first lead metadata if present via lat avg later — use first pin
    return [withGeo.lat, withGeo.lng];
  }, [mapLeads]);

  const bumpResults = useCallback(() => {
    setRefreshKey((k) => k + 1);
    onActivity?.();
  }, [onActivity]);

  const runWithIntent = useCallback(
    async (intent: ParsedLeadIntent, label?: string) => {
      if (!tenant?.id) return;
      setSearching(true);
      try {
        const withRadius: ParsedLeadIntent = {
          ...intent,
          location: {
            ...(intent.location || {}),
            radius_km: intent.location?.radius_km || radiusKm,
          },
        };
        const runRes = await fetch('/api/scraper-campaigns/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: tenant.id,
            action: 'run',
            intent: withRadius,
          }),
        });
        const runData = await runRes.json();
        if (!runRes.ok) throw new Error(runData.error || 'Search failed');

        setActiveCampaignId(runData.campaignId ?? null);
        bumpResults();
        toast.success(label || runData.reply || 'Search complete');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setSearching(false);
      }
    },
    [tenant?.id, radiusKm, bumpResults]
  );

  const runSearch = useCallback(async () => {
    if (!tenant?.id) return;
    const nicheTrim = niche.trim();
    const locationTrim = location.trim();
    if (!nicheTrim) {
      toast.error('Enter a business type or niche to search');
      return;
    }

    const query = locationTrim
      ? `Find ${nicheTrim} businesses in ${locationTrim} within ${radiusKm} km`
      : `Find ${nicheTrim} businesses within ${radiusKm} km`;

    setSearching(true);
    try {
      const parseRes = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          messages: [{ role: 'user', content: query }],
        }),
      });
      const parsed = await parseRes.json();
      if (!parseRes.ok) throw new Error(parsed.error || 'Failed to parse search');

      const intent = parsed.intent as ParsedLeadIntent | undefined;
      if (!intent) throw new Error('Could not build search intent');

      intent.location = {
        ...(intent.location || {}),
        radius_km: radiusKm,
      };

      await runWithIntent(intent);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
      setSearching(false);
    }
  }, [tenant?.id, niche, location, radiusKm, runWithIntent]);

  const handleProfileLoaded = useCallback(
    (profile: LeadFinderProfile) => {
      if (!profileLoaded) {
        if (profile.niche) setNiche(profile.niche);
        if (profile.location) setLocation(profile.location);
        setProfileLoaded(true);
      }
    },
    [profileLoaded]
  );

  const handleSmartSearch = useCallback(
    (intent: ParsedLeadIntent) => {
      if (intent.niche) setNiche(intent.niche);
      const loc = intent.location;
      const locLabel = [loc?.city, loc?.country].filter(Boolean).join(', ') || loc?.city || '';
      if (locLabel) setLocation(locLabel);
      if (loc?.radius_km) setRadiusKm(loc.radius_km);
      void runWithIntent(intent, 'Smart search running from your saved profile…');
    },
    [runWithIntent]
  );

  return (
    <div className="space-y-4 min-h-0">
      <LeadFinderBeginnerGuide />

      <LeadFinderSmartBar
        onProfileLoaded={handleProfileLoaded}
        onSmartSearch={handleSmartSearch}
        searching={searching}
      />

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:p-5 shadow-lg">
        <div className="flex flex-col xl:flex-row gap-3">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="block sm:col-span-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
                Business type / niche
              </span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
                  placeholder="e.g. dental clinics, HVAC contractors"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
                Location
              </span>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
                  placeholder="e.g. Austin, TX"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
                Reach radius
              </span>
              <div className="relative">
                <Radar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                >
                  {RADIUS_OPTIONS.map((km) => (
                    <option key={km} value={km}>
                      {km} km
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>
          <div className="flex flex-col sm:flex-row xl:flex-col justify-end gap-2 shrink-0">
            <label className="flex items-center gap-2 text-sm text-slate-400 px-1">
              <input
                type="checkbox"
                checked={hasEmail}
                onChange={(e) => setHasEmail(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500"
              />
              Has email
            </label>
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={searching}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {searching ? 'Scraping…' : 'Search prospects'}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Free open data only — OpenStreetMap, Wikidata, Photon, DuckDuckGo, Foursquare free tier. No paid lead databases.
          Select rows → Save to CRM when results land.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] gap-4 md:gap-6 min-h-0">
        <div className="space-y-4 min-h-0">
          <ScraperLeadsTable
            key={refreshKey}
            campaignId={activeCampaignId}
            hasEmailOnly={hasEmail}
            locationFilter={location.trim() || undefined}
            showAllWhenNoCampaign
            onActionComplete={onActivity}
            onLeadsChange={setMapLeads}
            refreshToken={refreshKey}
          />
        </div>
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <LeadFinderLiveProgress
            campaignId={activeCampaignId}
            searching={searching}
            niche={niche}
            location={location}
            radiusKm={radiusKm}
            onCompleted={bumpResults}
          />
          <LeadFinderMapPanel
            leads={mapPins}
            previewCenter={previewCenter}
            previewRadiusKm={radiusKm}
            emptyHint="Search to watch free geo leads appear on the map."
          />
          <div className="max-h-[min(40vh,360px)] overflow-y-auto ac-scroll-full">
            <LeadFinderSystemPanel compact />
          </div>
        </div>
      </div>
    </div>
  );
}
