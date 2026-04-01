'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Database, Zap, Globe, Mail, Phone, Plus, RefreshCw,
  SlidersHorizontal, Star, MapPin, X, ChevronDown, LayoutGrid, Map,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar } from '../ui/Avatar';
import { useTenant } from '../../contexts/TenantContext';
import { businessClientService } from '../../services/businessClientService';

// Leaflet requires window — load it client-side only
const LeadMapView = dynamic(() => import('./LeadMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40" style={{ height: 480 }}>
      <div className="text-slate-500 text-sm flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading map…
      </div>
    </div>
  ),
});

// ─── Types ───────────────────────────────────────────────────────────────────
interface ScrapedLead {
  business_name: string;
  website:       string;
  snippet?:      string;
  emails?:       string[];
  phone?:        string;
  address?:      string;
  rating?:       number;
  category?:     string;
  source?:       'yelp' | 'here' | 'osm';
  social_links?: Record<string, string>;
  status:        'pending' | 'crawling' | 'success' | 'failed';
  lat?:          number;
  lng?:          number;
}

type SourceFilter = 'all' | 'yelp' | 'here' | 'osm';

const SOURCE_LABELS: Record<SourceFilter, string> = {
  all:  'All Sources',
  yelp: '🟠 Yelp',
  here: '🔵 HERE',
  osm:  '🟢 OpenStreetMap',
};

const SOURCE_COLORS: Record<string, string> = {
  yelp: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  here: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  osm:  'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
};

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return null;
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full  }).map((_, i) => <Star key={`f${i}`} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
      {half && <Star className="w-3 h-3 fill-amber-400/50 text-amber-400" />}
      {Array.from({ length: empty }).map((_, i) => <Star key={`e${i}`} className="w-3 h-3 text-slate-700" />)}
      <span className="ml-1 text-[10px] text-slate-400 font-mono">{rating.toFixed(1)}</span>
    </div>
  );
}

function getHostname(url: string) {
  try {
    const h = new URL(url).hostname;
    return h.startsWith('www.') ? h.slice(4) : h;
  } catch { return url; }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OmniLeadFinder() {
  // ── Search State ──────────────────────────────────────────────────────────
  const [niche,        setNiche        ] = useState('');
  const [location,     setLocation     ] = useState('');
  const [usePlaywright, setUsePlaywright] = useState(false);
  const [scanning,     setScanning     ] = useState(false);
  const [results,      setResults      ] = useState<ScrapedLead[]>([]);
  const [progress,     setProgress     ] = useState({ percent: 0, message: '' });
  const [sourceStats,  setSourceStats  ] = useState<Record<string, number>>({});

  const { currentTenant } = useTenant();

  // ── Filter State (5 Filters) ──────────────────────────────────────────────
  const [filterText,   setFilterText   ] = useState('');           // 1. text search
  const [filterRating, setFilterRating ] = useState(0);            // 2. min star rating (0 = off)
  const [filterSource, setFilterSource ] = useState<SourceFilter>('all'); // 3. source
  const [filterPhone,  setFilterPhone  ] = useState(false);        // 4. has phone
  const [filterEmail,  setFilterEmail  ] = useState(false);        // 5. has email
  const [filtersOpen,  setFiltersOpen  ] = useState(false);
  const [viewMode,     setViewMode     ] = useState<'grid' | 'map'>('grid');

  // Active filter count badge
  const activeFilterCount = [
    filterText.length > 0,
    filterRating > 0,
    filterSource !== 'all',
    filterPhone,
    filterEmail,
  ].filter(Boolean).length;

  // ── Filtered Results (all 5 filters applied) ──────────────────────────────
  const filteredResults = useMemo(() => {
    const q = filterText.toLowerCase();
    return results.filter(lead => {
      if (q && ![lead.business_name, lead.website, lead.emails?.[0] || '', lead.address || '', lead.category || '']
        .some(v => v.toLowerCase().includes(q))) return false;
      if (filterRating > 0 && (lead.rating === undefined || lead.rating < filterRating)) return false;
      if (filterSource !== 'all' && lead.source !== filterSource) return false;
      if (filterPhone && !lead.phone) return false;
      if (filterEmail && !(lead.emails?.length)) return false;
      return true;
    });
  }, [results, filterText, filterRating, filterSource, filterPhone, filterEmail]);

  // ── Save to CRM ───────────────────────────────────────────────────────────
  const handleSaveToCRM = async (lead: ScrapedLead) => {
    if (!currentTenant) return toast.error('No active business context found');
    const toastId = toast.loading(`Syncing ${lead.business_name}…`);
    try {
      const { error } = await businessClientService.createClient(currentTenant.id, {
        name:        lead.business_name,
        email:       lead.emails?.[0] || '',
        phone:       lead.phone || '',
        website:     lead.website,
        salesStage:  'lead',
        industry:    niche,
        description: lead.snippet || `Lead via ${lead.source?.toUpperCase() || 'Omni Search'}`,
      });
      if (error) throw new Error(error);
      toast.success('Lead synchronized to CRM!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save lead', { id: toastId });
    }
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche) return toast.error('Please enter an industry or niche');

    setScanning(true);
    setResults([]);
    setSourceStats({});
    setProgress({ percent: 15, message: `Querying Yelp · HERE Maps · OpenStreetMap for "${niche}"…` });

    try {
      const searchRes = await fetch('/api/scraper/search', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ niche, location, usePlaywright }),
      });

      setProgress({ percent: 60, message: 'Aggregating directory results…' });
      const searchData = await searchRes.json();

      if (!searchData.success || !searchData.results?.length) {
        throw new Error(searchData.error || 'No results found from any directory.');
      }

      if (searchData.sources) setSourceStats(searchData.sources);

      // Map API results → ScrapedLead with status
      const leads: ScrapedLead[] = searchData.results.map((r: any) => ({
        ...r,
        status: r.emails?.length ? 'success' : 'pending',
      }));

      setResults(leads);
      setProgress({ percent: 100, message: 'Complete' });
      toast.success(`Found ${leads.length} leads from ${Object.values(searchData.sources || {}).filter(Boolean).length} sources!`);
    } catch (err: any) {
      toast.error(err.message || 'Search failed. Check API keys or try a different location.');
    } finally {
      setTimeout(() => setScanning(false), 800);
    }
  };

  const clearFilters = () => {
    setFilterText(''); setFilterRating(0);
    setFilterSource('all'); setFilterPhone(false); setFilterEmail(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-4">

      {/* ── Header + Search (unchanged from original) ── */}
      <div className="flex flex-col justify-between items-start lg:flex-row lg:items-center p-4 bg-gradient-to-r from-teal-900/40 via-slate-900/40 to-slate-900/80 rounded-xl border border-teal-500/20 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="space-y-1 z-10 lg:pr-6">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-[10px] font-semibold tracking-wider uppercase mb-0.5">
            <Zap className="w-2.5 h-2.5 fill-current" /> Enterprise Engine
          </div>
          <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-200 to-emerald-300 tracking-tight">
            AlphaClone Business Lead
          </h1>
          <p className="text-slate-400 max-w-md text-xs font-light leading-relaxed">
            Universal acquisition engine — Yelp · HERE Maps · OpenStreetMap.{' '}
            {usePlaywright ? 'Power Mode: Browser clusters active.' : 'Standard Mode: All directories active.'}
          </p>
          {/* Source stats pills */}
          {Object.keys(sourceStats).length > 0 && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {Object.entries(sourceStats).map(([src, count]) => (
                count > 0 ? (
                  <span key={src} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${SOURCE_COLORS[src] || 'text-slate-400 border-slate-700 bg-slate-800'}`}>
                    {src.toUpperCase()}: {String(count)}
                  </span>
                ) : null
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSearch} className="mt-4 lg:mt-0 w-full lg:w-auto z-10 flex flex-col gap-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text" placeholder="Industry (e.g. HVAC)"
              value={niche} onChange={e => setNiche(e.target.value)}
              disabled={scanning}
              className="px-2.5 py-1.5 text-xs bg-slate-900/80 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none text-white transition-all shadow-inner w-full md:w-48"
            />
            <input
              type="text" placeholder="City (e.g. Miami)"
              value={location} onChange={e => setLocation(e.target.value)}
              disabled={scanning}
              className="px-2.5 py-1.5 text-xs bg-slate-900/80 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none text-white transition-all shadow-inner w-full md:w-48"
            />
          </div>

          {/* Power Mode toggle */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => !scanning && setUsePlaywright(!usePlaywright)}>
              <div className={`w-7 h-3.5 rounded-full transition-colors relative ${usePlaywright ? 'bg-teal-500' : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${usePlaywright ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-widest ${usePlaywright ? 'text-teal-400' : 'text-slate-500'}`}>
                Power Mode
              </span>
            </div>
          </div>

          <button
            type="submit" disabled={scanning || !niche}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 mt-0.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-medium text-xs rounded-lg transition-all shadow-lg disabled:opacity-50"
          >
            {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
            {scanning ? 'Scanning directories…' : 'Deploy Universal Engine'}
          </button>
        </form>
      </div>

      {/* ── Progress Bar ── */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden"
          >
            <div className="flex justify-between text-[10px] mb-1.5">
              <span className="text-teal-300 font-mono flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                {progress.message}
              </span>
              <span className="text-white font-mono font-bold">{progress.percent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 h-full rounded-full"
                initial={{ width: 0 }} animate={{ width: `${progress.percent}%` }} transition={{ duration: 0.4 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5 Filters Panel ── */}
      {results.length > 0 && (
        <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">

          {/* Filter Header Row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-teal-400" />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-teal-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span>Found: <span className="text-white font-bold">{results.length}</span></span>
              <span>Showing: <span className="text-teal-400 font-bold">{filteredResults.length}</span></span>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>

          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

                  {/* Filter 1: Text Search */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Search</label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                      <input
                        type="text" placeholder="Name, email, category…"
                        value={filterText} onChange={e => setFilterText(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200 focus:ring-2 focus:ring-teal-500/30 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Filter 2: Min Star Rating */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Min Rating</label>
                    <div className="flex items-center gap-1">
                      {[0, 1, 2, 3, 4, 5].map(r => (
                        <button
                          key={r}
                          onClick={() => setFilterRating(r === filterRating ? 0 : r)}
                          className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all border ${
                            filterRating === r
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : 'border-slate-800 text-slate-500 hover:border-slate-600'
                          }`}
                        >
                          {r === 0 ? 'Any' : <><Star className={`w-3 h-3 ${filterRating >= r ? 'fill-amber-400 text-amber-400' : ''}`} />{r}+</>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filter 3: Source */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Directory Source</label>
                    <div className="flex flex-wrap gap-1">
                      {(['all', 'yelp', 'here', 'osm'] as SourceFilter[]).map(src => (
                        <button
                          key={src}
                          onClick={() => setFilterSource(src)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
                            filterSource === src
                              ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                              : 'border-slate-800 text-slate-500 hover:border-slate-600'
                          }`}
                        >
                          {SOURCE_LABELS[src]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filter 4: Has Phone */}
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Has Phone</label>
                    <button
                      onClick={() => setFilterPhone(!filterPhone)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${filterPhone ? 'bg-teal-500' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${filterPhone ? 'left-5' : 'left-0.5'}`} />
                    </button>
                    {filterPhone && <span className="text-[10px] text-teal-400 font-medium">Active</span>}
                  </div>

                  {/* Filter 5: Has Email */}
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Has Email</label>
                    <button
                      onClick={() => setFilterEmail(!filterEmail)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${filterEmail ? 'bg-teal-500' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${filterEmail ? 'left-5' : 'left-0.5'}`} />
                    </button>
                    {filterEmail && <span className="text-[10px] text-teal-400 font-medium">Active</span>}
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Always-visible quick text filter when closed */}
          {!filtersOpen && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text" placeholder="Quick filter results…"
                value={filterText} onChange={e => setFilterText(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950/50 border border-slate-800 rounded-lg text-xs text-slate-200 focus:ring-2 focus:ring-teal-500/30 outline-none"
              />
            </div>
          )}
        </div>
      )}

      {/* ── View Toggle ── */}
      {filteredResults.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1 bg-slate-900/70 rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'map'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Map className="w-3.5 h-3.5" /> Map View
            </button>
          </div>
        </div>
      )}

      {/* ── Map View ── */}
      {viewMode === 'map' && filteredResults.length > 0 && (
        <div className="space-y-2">
          <LeadMapView leads={filteredResults} />
          {filteredResults.filter(l => !l.lat).length > 0 && (
            <p className="text-[10px] text-slate-500 text-center">
              {filteredResults.filter(l => !l.lat).length} lead{filteredResults.filter(l => !l.lat).length !== 1 ? 's' : ''} without coordinates not shown on map
            </p>
          )}
        </div>
      )}

      {/* ── Results Grid ── */}
      {viewMode === 'grid' && filteredResults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredResults.map((lead, idx) => {
            const domain = getHostname(lead.website);
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.025 }}
                className="group bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 hover:border-teal-500/50 hover:bg-slate-800/80 transition-all duration-300 shadow-md hover:shadow-teal-500/10 flex flex-col"
              >
                {/* Card Header: Name + Source Badge */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="border border-slate-700 group-hover:border-teal-400 transition-colors rounded-lg p-0.5 bg-slate-800 flex-shrink-0">
                      <Avatar name={lead.business_name} size={30} shape="rounded" className="rounded-md" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-semibold text-sm leading-tight truncate group-hover:text-teal-300 transition-colors">
                        {lead.business_name}
                      </h3>
                      {domain && (
                        <a href={lead.website} target="_blank" rel="noreferrer"
                          className="text-slate-400 text-[10px] hover:text-teal-400 flex items-center gap-1 mt-0.5 transition-colors truncate">
                          <Globe className="w-2.5 h-2.5 flex-shrink-0" /> {domain}
                        </a>
                      )}
                    </div>
                  </div>
                  {lead.source && (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border flex-shrink-0 uppercase ${SOURCE_COLORS[lead.source] || ''}`}>
                      {lead.source}
                    </span>
                  )}
                </div>

                {/* Rating */}
                {lead.rating && (
                  <div className="mb-1.5">
                    <StarRating rating={lead.rating} />
                  </div>
                )}

                {/* Category */}
                {lead.category && (
                  <p className="text-[10px] text-slate-500 truncate mb-2">{lead.category}</p>
                )}

                {/* Contact Details */}
                <div className="flex-grow space-y-1.5 py-2 border-t border-slate-800/50">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    {lead.emails?.[0] ? (
                      <span className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20 truncate">
                        {lead.emails[0]}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-600">No email</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    <span className="text-[10px] text-slate-300 truncate">
                      {lead.phone || <span className="text-slate-600">No phone</span>}
                    </span>
                  </div>
                  {lead.address && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                      <span className="text-[10px] text-slate-400 leading-tight line-clamp-2">{lead.address}</span>
                    </div>
                  )}
                </div>

                {/* CRM Sync */}
                <button
                  onClick={() => handleSaveToCRM(lead)}
                  className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-1.5 hover:bg-teal-600/30 text-teal-400 hover:text-teal-300 font-medium text-[11px] rounded-lg border border-teal-500/20 hover:border-teal-500/50 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Sync CRM
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Empty State ── */}
      {!scanning && results.length > 0 && filteredResults.length === 0 && (
        <div className="text-center py-10 text-slate-500">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No results match your filters.</p>
          <button onClick={clearFilters} className="mt-2 text-xs text-teal-400 hover:text-teal-300 underline">Clear all filters</button>
        </div>
      )}
    </div>
  );
}
