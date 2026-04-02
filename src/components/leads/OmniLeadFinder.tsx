'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Database, Zap, Globe, Mail, Phone, Plus, RefreshCw,
  SlidersHorizontal, Star, MapPin, X, ChevronDown, LayoutGrid, Map,
  Filter, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar } from '../ui/Avatar';
import { useTenant } from '../../contexts/TenantContext';
import { businessClientService } from '../../services/businessClientService';

// Leaflet requires window — load client-side only
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

// ─── Types ────────────────────────────────────────────────────────────────────
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

const SOURCE_COLORS: Record<string, string> = {
  yelp: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  here: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  osm:  'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
};

// ─── Industry Groups (80+ options) ───────────────────────────────────────────
const INDUSTRY_GROUPS: Record<string, string[]> = {
  '🏠 Home Services': [
    'HVAC', 'Plumbing', 'Electrician', 'Roofing', 'Landscaping',
    'Cleaning Service', 'Pest Control', 'Pool Service', 'Painting',
    'Flooring', 'Window Cleaning', 'Garage Door Repair', 'Handyman',
    'Gutter Cleaning', 'Tree Service', 'Locksmith', 'Solar Installation',
  ],
  '🏥 Healthcare': [
    'Dentist', 'Chiropractor', 'Physical Therapist', 'Optometrist',
    'Dermatologist', 'Pediatrician', 'Veterinarian', 'Pharmacy',
    'Mental Health Counselor', 'Massage Therapist', 'Urgent Care',
    'Acupuncture', 'Hearing Clinic',
  ],
  '🍽️ Food & Hospitality': [
    'Restaurant', 'Cafe', 'Bakery', 'Bar', 'Catering',
    'Food Truck', 'Hotel', 'Bed and Breakfast', 'Night Club',
    'Pizza Shop', 'Sushi', 'Steakhouse',
  ],
  '⚖️ Professional Services': [
    'Law Firm', 'Accountant', 'Financial Advisor', 'Insurance Agent',
    'Real Estate Agent', 'Mortgage Broker', 'Business Consultant',
    'Marketing Agency', 'Advertising Agency', 'PR Firm',
    'Notary', 'Tax Consultant',
  ],
  '🔧 Auto & Transport': [
    'Auto Repair', 'Car Dealership', 'Towing Service', 'Car Wash',
    'Auto Body Shop', 'Tire Shop', 'Moving Company', 'Trucking',
    'Limousine Service', 'Auto Glass',
  ],
  '💻 Tech & Digital': [
    'IT Services', 'Web Design', 'Software Development',
    'Cyber Security', 'Data Recovery', 'Phone Repair',
    'IT Support', 'AI Consulting',
  ],
  '🏋️ Fitness & Wellness': [
    'Gym', 'Yoga Studio', 'Pilates', 'Personal Trainer',
    'Spa', 'Nail Salon', 'Hair Salon', 'Barber Shop',
    'Tanning Salon', 'Tattoo Studio',
  ],
  '🏗️ Construction': [
    'General Contractor', 'Cabinet Maker', 'Concrete', 'Demolition',
    'Fencing', 'Masonry', 'Insulation', 'Drywall',
    'Excavation', 'Paving',
  ],
  '📦 Retail & Commerce': [
    'Grocery Store', 'Clothing Store', 'Furniture Store',
    'Pet Store', 'Bookstore', 'Gift Shop', 'Hardware Store',
    'Jewellery Store', 'Electronics Store',
  ],
  '🎓 Education': [
    'Tutoring', 'Driving School', 'Music School',
    'Childcare', 'Preschool', 'Language School',
    'Art Classes', 'Dance Studio',
  ],
};

const ALL_INDUSTRIES = Object.values(INDUSTRY_GROUPS).flat();

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Industry Combobox (rendered in a portal-like absolute, no overflow clip) ─
interface IndustrySelectProps {
  value:    string;
  onChange: (v: string) => void;
  disabled: boolean;
}

function IndustrySelect({ value, onChange, disabled }: IndustrySelectProps) {
  const [search, setSearch]   = useState('');
  const [open, setOpen]       = useState(false);
  const containerRef          = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-xl border transition-all outline-none ${
          open
            ? 'border-teal-500 ring-2 ring-teal-500/25 bg-slate-900'
            : 'border-slate-700 bg-slate-900/80 hover:border-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <Building2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
        <span className={`flex-1 text-left truncate ${value ? 'text-white' : 'text-slate-500'}`}>
          {value || 'Select industry…'}
        </span>
        {value && (
          <X
            className="w-3.5 h-3.5 text-slate-500 hover:text-rose-400 flex-shrink-0"
            onClick={e => { e.stopPropagation(); onChange(''); setSearch(''); }}
          />
        )}
        <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown — rendered OUTSIDE button but inside container (no overflow clip parent) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
            style={{ zIndex: 9999, maxWidth: '380px' }}
          >
            {/* Search inside dropdown */}
            <div className="p-2 border-b border-slate-800 bg-slate-950 sticky top-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search all industries…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-teal-500 transition-colors"
                />
              </div>
              <p className="text-[10px] text-slate-600 mt-1 px-0.5">{ALL_INDUSTRIES.length} industries across {Object.keys(INDUSTRY_GROUPS).length} categories</p>
            </div>

            {/* Grouped list */}
            <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
              {/* Custom value option */}
              {search && !ALL_INDUSTRIES.some(i => i.toLowerCase() === search.toLowerCase()) && (
                <div
                  className="px-3 py-2.5 text-sm text-teal-400 hover:bg-teal-500/10 cursor-pointer border-b border-slate-800 flex items-center gap-2"
                  onClick={() => { onChange(search); setOpen(false); setSearch(''); }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Use &quot;{search}&quot; as custom industry
                </div>
              )}

              {Object.entries(INDUSTRY_GROUPS).map(([group, items]) => {
                const filtered = items.filter(i => i.toLowerCase().includes(search.toLowerCase()));
                if (filtered.length === 0) return null;
                return (
                  <div key={group}>
                    <p className="px-3 py-1 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-900/60 border-b border-slate-800/50">
                      {group}
                    </p>
                    {filtered.map(industry => (
                      <div
                        key={industry}
                        className={`px-4 py-2 text-sm cursor-pointer transition-colors ${
                          value === industry
                            ? 'bg-teal-500/20 text-teal-300 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                        onClick={() => { onChange(industry); setOpen(false); setSearch(''); }}
                      >
                        {industry}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OmniLeadFinder() {
  // ── Search params ────────────────────────────────────────────────────────
  const [niche,        setNiche        ] = useState('');
  const [location,     setLocation     ] = useState('');
  const [usePlaywright, setUsePlaywright] = useState(false);
  const [scanning,     setScanning     ] = useState(false);
  const [results,      setResults      ] = useState<ScrapedLead[]>([]);
  const [progress,     setProgress     ] = useState({ percent: 0, message: '' });
  const [sourceStats,  setSourceStats  ] = useState<Record<string, number>>({});
  const [viewMode,     setViewMode     ] = useState<'grid' | 'map'>('grid');

  const { currentTenant } = useTenant();

  // ── Post-search result filters ───────────────────────────────────────────
  const [filterText,   setFilterText  ] = useState('');
  const [filterRating, setFilterRating] = useState(0);
  const [filterSource, setFilterSource] = useState<SourceFilter>('all');
  const [filterPhone,  setFilterPhone ] = useState(false);
  const [filterEmail,  setFilterEmail ] = useState(false);

  const activeFilterCount = [
    filterText.length > 0, filterRating > 0,
    filterSource !== 'all', filterPhone, filterEmail,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterText(''); setFilterRating(0);
    setFilterSource('all'); setFilterPhone(false); setFilterEmail(false);
  };

  // ── Filtered results ──────────────────────────────────────────────────────
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
        name: lead.business_name, email: lead.emails?.[0] || '',
        phone: lead.phone || '', website: lead.website,
        salesStage: 'lead', industry: niche,
        description: lead.snippet || `Lead via ${lead.source?.toUpperCase()}`,
      });
      if (error) throw new Error(error);
      toast.success('Lead synced to CRM!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save', { id: toastId });
    }
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche) return toast.error('Please select an industry');

    setScanning(true); setResults([]); setSourceStats({}); clearFilters();
    setProgress({ percent: 15, message: `Querying Yelp · HERE · OpenStreetMap for "${niche}"…` });

    try {
      const res = await fetch('/api/scraper/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, location, usePlaywright }),
      });

      setProgress({ percent: 60, message: 'Aggregating results…' });
      const data = await res.json();

      if (!data.success || !data.results?.length) {
        throw new Error(data.error || 'No results found. Try a different city or industry.');
      }

      if (data.sources) setSourceStats(data.sources);
      const leads: ScrapedLead[] = data.results.map((r: any) => ({
        ...r, status: r.emails?.length ? 'success' : 'pending',
      }));

      setResults(leads);
      setProgress({ percent: 100, message: 'Done' });
      toast.success(`Found ${leads.length} leads!`);
    } catch (err: any) {
      toast.error(err.message || 'Search failed');
    } finally {
      setTimeout(() => setScanning(false), 600);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-5">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="p-4 bg-gradient-to-r from-teal-900/40 via-slate-900/50 to-slate-900 rounded-xl border border-teal-500/20 shadow-xl backdrop-blur-xl">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-[10px] font-bold tracking-wider uppercase mb-1">
              <Zap className="w-2.5 h-2.5 fill-current" /> Enterprise Engine
            </div>
            <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-200 to-emerald-300">
              AlphaClone Business Lead
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Powered by Yelp · HERE Maps · OpenStreetMap — no 403 errors, always free.
            </p>
          </div>
          {/* Source result pills */}
          {Object.keys(sourceStats).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(sourceStats).map(([src, count]) =>
                count > 0 ? (
                  <span key={src} className={`text-[9px] font-black px-2 py-1 rounded-full border ${SOURCE_COLORS[src] || 'text-slate-400 border-slate-700 bg-slate-800'}`}>
                    {src.toUpperCase()}: {count}
                  </span>
                ) : null
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ SEARCH FORM (outside overflow-hidden, dropdown never clipped) ══ */}
      <form onSubmit={handleSearch} className="space-y-3">

        {/* Row 1: Industry + City */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* Industry — full searchable combobox, no clipping parent */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3 h-3 text-teal-400" /> Industry *
            </label>
            <IndustrySelect value={niche} onChange={setNiche} disabled={scanning} />
          </div>

          {/* City */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-teal-400" /> City / Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. Miami, London, Warsaw…"
                value={location}
                onChange={e => setLocation(e.target.value)}
                disabled={scanning}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-900/80 border border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 outline-none text-white transition-all hover:border-slate-600 disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Power Mode + Submit */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div
            className={`flex items-center gap-2.5 cursor-pointer group select-none ${scanning ? 'opacity-40 pointer-events-none' : ''}`}
            onClick={() => setUsePlaywright(v => !v)}
          >
            <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${usePlaywright ? 'bg-teal-500' : 'bg-slate-700'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${usePlaywright ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className={`text-xs font-bold ${usePlaywright ? 'text-teal-400' : 'text-slate-500'}`}>Power Mode</p>
              <p className="text-[9px] text-slate-600">Browser cluster extraction</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={scanning || !niche}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {scanning ? 'Scanning…' : 'Deploy Universal Engine'}
          </button>
        </div>
      </form>

      {/* ══ PROGRESS BAR ════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden"
          >
            <div className="flex justify-between text-[11px] mb-2">
              <span className="text-teal-300 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" /> {progress.message}
              </span>
              <span className="text-white font-mono font-bold">{progress.percent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <motion.div
                className="bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 h-full rounded-full"
                animate={{ width: `${progress.percent}%` }} transition={{ duration: 0.4 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ POST-SEARCH FILTERS + VIEW TOGGLE (appear after results load) ══ */}
      {results.length > 0 && (
        <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">

          {/* Header row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-xs font-bold text-slate-300">Filter Results</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-teal-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span>Total: <b className="text-white">{results.length}</b></span>
              <span>Showing: <b className="text-teal-400">{filteredResults.length}</b></span>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-rose-400 hover:text-rose-300">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Filter controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

            {/* 1. Text search */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Search results</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text" placeholder="Name, email, category…"
                  value={filterText} onChange={e => setFilterText(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-slate-200 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* 2. Source */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Directory Source</label>
              <div className="flex flex-wrap gap-1">
                {(['all', 'yelp', 'here', 'osm'] as SourceFilter[]).map(src => (
                  <button key={src} onClick={() => setFilterSource(src)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                      filterSource === src
                        ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                        : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                    }`}>
                    {src === 'all' ? 'All' : src === 'osm' ? '🟢 OSM' : src === 'yelp' ? '🟠 Yelp' : '🔵 HERE'}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Min Rating */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Min Rating</label>
              <div className="flex items-center gap-1">
                {[0,1,2,3,4,5].map(r => (
                  <button key={r} onClick={() => setFilterRating(r === filterRating ? 0 : r)}
                    className={`flex items-center gap-0.5 px-1.5 py-1 rounded text-[11px] font-bold transition-all border ${
                      filterRating === r
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'border-slate-800 text-slate-500 hover:border-slate-600'
                    }`}>
                    {r === 0 ? 'Any' : <>{r}★</>}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Has Phone */}
            <div className="flex items-center gap-3 py-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider min-w-[70px]">Has Phone</label>
              <button onClick={() => setFilterPhone(!filterPhone)}
                className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${filterPhone ? 'bg-teal-500' : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${filterPhone ? 'left-5' : 'left-0.5'}`} />
              </button>
              {filterPhone && <span className="text-[11px] text-teal-400">Active</span>}
            </div>

            {/* 5. Has Email */}
            <div className="flex items-center gap-3 py-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider min-w-[70px]">Has Email</label>
              <button onClick={() => setFilterEmail(!filterEmail)}
                className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${filterEmail ? 'bg-teal-500' : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${filterEmail ? 'left-5' : 'left-0.5'}`} />
              </button>
              {filterEmail && <span className="text-[11px] text-teal-400">Active</span>}
            </div>

          </div>

          {/* View toggle */}
          <div className="flex items-center justify-end pt-1 border-t border-slate-800/50">
            <div className="flex items-center gap-1 bg-slate-950/70 rounded-lg p-0.5 border border-slate-800">
              {(['grid', 'map'] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === mode
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  {mode === 'grid' ? <><LayoutGrid className="w-3.5 h-3.5" /> Grid</> : <><Map className="w-3.5 h-3.5" /> Map</>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ MAP VIEW ════════════════════════════════════════════════════════ */}
      {viewMode === 'map' && filteredResults.length > 0 && (
        <div className="space-y-2">
          <LeadMapView leads={filteredResults} />
          {filteredResults.filter(l => !l.lat).length > 0 && (
            <p className="text-[10px] text-slate-500 text-center">
              {filteredResults.filter(l => !l.lat).length} leads without coordinates not shown on map
            </p>
          )}
        </div>
      )}

      {/* ══ GRID VIEW ═══════════════════════════════════════════════════════ */}
      {viewMode === 'grid' && filteredResults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredResults.map((lead, idx) => {
            const domain = getHostname(lead.website);
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                className="group bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 hover:border-teal-500/50 hover:bg-slate-800/80 transition-all duration-300 shadow hover:shadow-teal-500/10 flex flex-col"
              >
                {/* Card header */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="border border-slate-700 group-hover:border-teal-400 rounded-lg p-0.5 bg-slate-800 flex-shrink-0 transition-colors">
                      <Avatar name={lead.business_name} size={28} shape="rounded" className="rounded-md" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-semibold text-sm leading-tight truncate group-hover:text-teal-300 transition-colors">
                        {lead.business_name}
                      </h3>
                      {domain && (
                        <a href={lead.website} target="_blank" rel="noreferrer"
                          className="text-slate-500 text-[10px] hover:text-teal-400 flex items-center gap-1 mt-0.5 transition-colors truncate">
                          <Globe className="w-2.5 h-2.5 flex-shrink-0" /> {domain}
                        </a>
                      )}
                    </div>
                  </div>
                  {lead.source && (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border flex-shrink-0 uppercase ml-1 ${SOURCE_COLORS[lead.source] || ''}`}>
                      {lead.source}
                    </span>
                  )}
                </div>

                {lead.rating && <div className="mb-1.5"><StarRating rating={lead.rating} /></div>}
                {lead.category && <p className="text-[10px] text-slate-500 truncate mb-1">{lead.category}</p>}

                {/* Contact */}
                <div className="flex-grow space-y-1.5 py-2 border-t border-slate-800/50">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    {lead.emails?.[0]
                      ? <span className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20 truncate">{lead.emails[0]}</span>
                      : <span className="text-[10px] text-slate-600">No email</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    <span className="text-[10px] text-slate-300 truncate">{lead.phone || <span className="text-slate-600">No phone</span>}</span>
                  </div>
                  {lead.address && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                      <span className="text-[10px] text-slate-400 leading-tight line-clamp-2">{lead.address}</span>
                    </div>
                  )}
                </div>

                {/* CRM sync */}
                <button onClick={() => handleSaveToCRM(lead)}
                  className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-1.5 hover:bg-teal-600/20 text-teal-400 hover:text-teal-300 text-[11px] font-medium rounded-lg border border-teal-500/20 hover:border-teal-500/40 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Sync to CRM
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ══ EMPTY FILTER STATE ═══════════════════════════════════════════════ */}
      {!scanning && results.length > 0 && filteredResults.length === 0 && (
        <div className="text-center py-10 text-slate-500">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No results match your filters.</p>
          <button onClick={clearFilters} className="mt-2 text-xs text-teal-400 hover:underline">Clear all filters</button>
        </div>
      )}
    </div>
  );
}
