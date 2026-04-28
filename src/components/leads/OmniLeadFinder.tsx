'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Database, Zap, Globe, Mail, Phone, Plus, RefreshCw,
  SlidersHorizontal, Star, MapPin, X, ChevronDown, LayoutGrid, Map,
  Filter, Building2, ArrowUpDown, CheckCircle2, Save, Sparkles, History, Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar } from '../ui/Avatar';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';
import { useBackgroundTasks } from '../../contexts/BackgroundTaskContext';
import { businessClientService } from '../../services/businessClientService';
import { leadService } from '../../services/leadService';
import { supabase } from '../../lib/supabase';
import { qualifyLead, QualificationResult } from '../../lib/leadQualification';
import { OutreachPanel } from './OutreachPanel';

// Leaflet: window-only
const LeadMapView = dynamic(() => import('./LeadMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[min(100vw,260px)] h-[min(50svh,520px)] sm:min-h-[320px] md:h-[480px] max-h-[640px] flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="text-slate-500 text-sm flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading map...
      </div>
    </div>
  ),
});

// ── Types ──────────────────────────────────────────────
interface ScrapedLead {
  business_name: string;
  website:       string;
  snippet?:      string;
  email?:        string;
  emails?:       string[];
  phone?:        string;
  address?:      string;
  rating?:       number;
  category?:     string;
  source?:       'yelp' | 'here' | 'osm' | 'browser' | 'google';
  status:        'pending' | 'saved' | 'failed';
  lat?:          number;
  lng?:          number;
  qualification?: QualificationResult;  // added by engine post-search
}

interface MapSearchHistoryEntry {
  id: string;
  createdAt: string;
  niche: string;
  location: string;
  radiusKm: number;
  leadCount: number;
  mappedLeadCount: number;
  leads: ScrapedLead[];
}

interface GeocodePreview {
  lat: number;
  lng: number;
  displayName: string;
  type: string;
}

type SourceFilter = 'all' | 'yelp' | 'here' | 'osm' | 'browser' | 'google';
type SortMode     = 'default' | 'rating_desc' | 'rating_asc';

const SOURCE_COLORS: Record<string, string> = {
  yelp: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  here: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  osm:  'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  browser: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
  google: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
};

// ── Industry Groups ──────────────────────────────────────
const INDUSTRY_GROUPS: Record<string, string[]> = {
  'Home Services': [
    'HVAC', 'Plumbing', 'Electrician', 'Roofing', 'Landscaping',
    'Cleaning Service', 'Pest Control', 'Pool Service', 'Painting',
    'Flooring', 'Window Cleaning', 'Garage Door Repair', 'Handyman',
    'Gutter Cleaning', 'Tree Service', 'Locksmith', 'Solar Installation',
  ],
  Healthcare: [
    'Dentist', 'Chiropractor', 'Physical Therapist', 'Optometrist',
    'Dermatologist', 'Pediatrician', 'Veterinarian', 'Pharmacy',
    'Mental Health Counselor', 'Massage Therapist', 'Urgent Care',
    'Acupuncture', 'Hearing Clinic',
  ],
  'Food & Hospitality': [
    'Restaurant', 'Cafe', 'Bakery', 'Bar', 'Catering',
    'Food Truck', 'Hotel', 'Bed and Breakfast', 'Night Club',
    'Pizza Shop', 'Sushi', 'Steakhouse',
  ],
  'Professional Services': [
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
  'Tech & Digital': [
    'IT Services', 'Web Design', 'Software Development',
    'Cyber Security', 'Data Recovery', 'Phone Repair',
    'IT Support', 'AI Consulting',
  ],
  'Fitness & Wellness': [
    'Gym', 'Yoga Studio', 'Pilates', 'Personal Trainer',
    'Spa', 'Nail Salon', 'Hair Salon', 'Barber Shop',
    'Tanning Salon', 'Tattoo Studio',
  ],
  Construction: [
    'General Contractor', 'Cabinet Maker', 'Concrete', 'Demolition',
    'Fencing', 'Masonry', 'Insulation', 'Drywall',
    'Excavation', 'Paving',
  ],
  'Retail & Commerce': [
    'Grocery Store', 'Clothing Store', 'Furniture Store',
    'Pet Store', 'Bookstore', 'Gift Shop', 'Hardware Store',
    'Jewellery Store', 'Electronics Store',
  ],
  Education: [
    'Tutoring', 'Driving School', 'Music School',
    'Childcare', 'Preschool', 'Language School',
    'Art Classes', 'Dance Studio',
  ],
};

const ALL_INDUSTRIES = Object.values(INDUSTRY_GROUPS).flat();

// ── Helpers ────────────────────────────────────────────
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
  try { const h = new URL(url).hostname; return h.startsWith('www.') ? h.slice(4) : h; }
  catch { return url; }
}

// ── Industry Combobox (self-contained, no overflow-hidden parent clip) ─────
function IndustrySelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(false);
  const ref                 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button" disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-xl border transition-all outline-none ${
          open ? 'border-teal-500 ring-2 ring-teal-500/20 bg-slate-900' : 'border-slate-700 bg-slate-900/80 hover:border-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <Building2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
        <span className={`flex-1 text-left truncate ${value ? 'text-white' : 'text-slate-500'}`}>
          {value || 'Select industry...'}
        </span>
        {value && (
          <X className="w-3.5 h-3.5 text-slate-500 hover:text-rose-400 flex-shrink-0"
             onClick={e => { e.stopPropagation(); onChange(''); setSearch(''); }} />
        )}
        <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl"
            style={{ zIndex: 9999, maxWidth: '400px' }}
          >
            {/* Search box */}
            <div className="p-2 border-b border-slate-800 bg-slate-950">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input autoFocus type="text" placeholder="Search industries..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-teal-500"
                />
              </div>
              <p className="text-[9px] text-slate-600 mt-1 px-0.5">{ALL_INDUSTRIES.length} industries · {Object.keys(INDUSTRY_GROUPS).length} categories</p>
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: '300px' }}>
              {/* Custom option */}
              {search && !ALL_INDUSTRIES.some(i => i.toLowerCase() === search.toLowerCase()) && (
                <div className="px-3 py-2 text-sm text-teal-400 hover:bg-teal-500/10 cursor-pointer border-b border-slate-800 flex items-center gap-2"
                     onClick={() => { onChange(search); setOpen(false); setSearch(''); }}>
                  <Plus className="w-3.5 h-3.5" /> Use &quot;{search}&quot; as custom industry
                </div>
              )}
              {Object.entries(INDUSTRY_GROUPS).map(([group, items]) => {
                const filtered = items.filter(i => i.toLowerCase().includes(search.toLowerCase()));
                if (!filtered.length) return null;
                return (
                  <div key={group}>
                    <p className="px-3 py-1 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-900/60 border-b border-slate-800/40">{group}</p>
                    {filtered.map(industry => (
                      <div key={industry}
                           className={`px-4 py-2 text-sm cursor-pointer transition-colors ${value === industry ? 'bg-teal-500/20 text-teal-300 font-semibold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                           onClick={() => { onChange(industry); setOpen(false); setSearch(''); }}>
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

// ── Main Component ────────────────────────────────────────
export default function OmniLeadFinder() {
  // Search config
  const [niche,         setNiche         ] = useState('');
  const [location,      setLocation      ] = useState('');
  const [sortMode,      setSortMode      ] = useState<SortMode>('default');
  const [usePlaywright, setUsePlaywright ] = useState(false);
  const [autoSave,      setAutoSave      ] = useState(false);

  // Runtime state
  const [scanning,    setScanning   ] = useState(false);
  const [results,     setResults    ] = useState<ScrapedLead[]>([]);
  const [progress,    setProgress   ] = useState({ percent: 0, message: '' });
  const [sourceStats, setSourceStats] = useState<Record<string, number>>({});
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [viewMode,    setViewMode   ] = useState<'grid' | 'map'>('grid');
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [savedIds,    setSavedIds   ] = useState<Set<number>>(new Set());
  const [specificCity, setSpecificCity] = useState('');
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(25);
  const [mapHistory, setMapHistory] = useState<MapSearchHistoryEntry[]>([]);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [geocodePreview, setGeocodePreview] = useState<GeocodePreview | null>(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);

  // Selection + outreach panel
  const [selectedSet,    setSelectedSet   ] = useState<Set<number>>(new Set());
  const [showOutreach,   setShowOutreach  ] = useState(false);

  const currentTenant = useCurrentTenantSafe();
  const { startTask } = useBackgroundTasks();

  // Validate that required functions are available
  useEffect(() => {
    if (typeof startTask !== 'function') {
        console.error('startTask function is not available. Background tasks will not work.');
    }
  }, []);

  useEffect(() => {
    try {
      const storedViewMode = window.localStorage.getItem('omniLeadFinder:viewMode');
      const storedMapCollapsed = window.localStorage.getItem('omniLeadFinder:mapCollapsed');
      const historyKey = `omniLeadFinder:mapHistory:${currentTenant?.id || 'global'}`;
      const rawHistory = window.localStorage.getItem(historyKey);
      if (storedViewMode === 'grid' || storedViewMode === 'map') {
        setViewMode(storedViewMode);
      }
      if (storedMapCollapsed === 'true') {
        setMapCollapsed(true);
      }
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          setMapHistory(parsed);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem('omniLeadFinder:viewMode', viewMode);
      window.localStorage.setItem('omniLeadFinder:mapCollapsed', String(mapCollapsed));
      const historyKey = `omniLeadFinder:mapHistory:${currentTenant?.id || 'global'}`;
      window.localStorage.setItem(historyKey, JSON.stringify(mapHistory.slice(0, 25)));
    } catch {
      // Ignore storage write errors
    }
  }, [viewMode, mapCollapsed, mapHistory, currentTenant?.id]);

  // Daily quota state
  const [dailyQuota, setDailyQuota] = useState<{ limit: number; used: number; remaining: number } | null>(null);

  // Post-search filters
  const [filterText,   setFilterText  ] = useState('');
  const [filterRating, setFilterRating] = useState(0);
  const [filterSource, setFilterSource] = useState<SourceFilter>('all');
  const [filterPhone,  setFilterPhone ] = useState(false);
  const [filterEmail,  setFilterEmail ] = useState(false);
  const [filterTier,   setFilterTier  ] = useState<'all' | 'hot' | 'warm' | 'cold' | 'skip'>('all');

  const activeFilterCount = [filterText.length > 0, filterRating > 0, filterSource !== 'all', filterPhone, filterEmail, filterTier !== 'all'].filter(Boolean).length;
  const clearFilters = () => { setFilterText(''); setFilterRating(0); setFilterSource('all'); setFilterPhone(false); setFilterEmail(false); setFilterTier('all'); };

  const filteredResults = useMemo(() => {
    const q = filterText.toLowerCase();
    return results.filter(lead => {
      if (q && ![
        lead.business_name,
        lead.website,
        lead.email || '',
        lead.address || '',
        lead.category || '',
        lead.phone || '',
        lead.snippet || ''
      ].some(v => v && v.toLowerCase().includes(q))) return false;
      if (filterRating > 0 && (lead.rating === undefined || lead.rating < filterRating)) return false;
      if (filterSource !== 'all' && lead.source !== filterSource) return false;
      if (filterPhone && !lead.phone) return false;
      if (filterEmail && !lead.email) return false;
      if (filterTier !== 'all' && lead.qualification?.tier !== filterTier) return false;
      return true;
    });
  }, [results, filterText, filterRating, filterSource, filterPhone, filterEmail, filterTier]);

  // Helper: qualify all leads after search
  function enrichWithQualification(leads: ScrapedLead[], industry: string): ScrapedLead[] {
    return leads.map(l => ({ ...l, qualification: qualifyLead(l, industry) }));
  }

  // Selected leads for outreach
  const selectedLeads = useMemo(() => filteredResults.filter((_, i) => selectedSet.has(i)), [filteredResults, selectedSet]);
  const toggleSelect  = (idx: number) => setSelectedSet(prev => { 
    const n = new Set(prev); 
    if (n.has(idx)) {
      n.delete(idx); 
    } else {
      if (n.size >= 20) {
        toast.error('Maximum 20 leads allowed for batch outreach');
        return prev;
      }
      n.add(idx); 
    }
    return n; 
  });
  const selectAll     = () => {
    if (filteredResults.length > 20) {
      setSelectedSet(new Set(filteredResults.slice(0, 20).map((_, i) => i)));
      toast.success('Selected first 20 leads for batch outreach');
    } else {
      setSelectedSet(new Set(filteredResults.map((_, i) => i)));
    }
  };
  const clearSelected = () => setSelectedSet(new Set());

  // ── Save single lead to CRM ────────────────────────────────
  const saveLeadToCRM = async (lead: ScrapedLead, idx: number): Promise<boolean> => {
    if (!currentTenant) return false;
    try {
      const { error } = await businessClientService.createClient(currentTenant.id, {
        name: lead.business_name,
        email: lead.email || lead.emails?.[0] || '',
        phone: lead.phone || '',
        website: lead.website,
        salesStage: 'lead',
        industry: niche,
        description: `Lead via ${lead.source?.toUpperCase()} · ${lead.category || lead.snippet || ''}`,
      });
      if (error) throw new Error(error);
      setSavedIds(prev => new Set([...prev, idx]));
      return true;
    } catch { return false; }
  };

  // ── Search ───────────────────────────────────────────
  function uniqueLeadInsights(lead: ScrapedLead): string {
    const items = [
      lead.qualification?.insights?.join('; '),
      lead.category ? `Category: ${lead.category}` : '',
      lead.rating ? `Rating: ${lead.rating}` : '',
      lead.source ? `Source: ${lead.source}` : '',
    ].filter(Boolean);
    return items.join(' | ');
  }

  const saveEnrichedLead = async (lead: ScrapedLead, idx: number, quiet = false): Promise<boolean> => {
    if (!currentTenant) return false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      const trustScore = lead.qualification?.score || 0;
      const { lead: savedLead, error } = await leadService.addLead({
        businessName: lead.business_name,
        email: lead.email || lead.emails?.[0] || '',
        phone: lead.phone || '',
        website: lead.website,
        industry: niche,
        location: lead.address || '',
        source: `Lead Finder:${lead.source || 'unknown'}`,
        notes: lead.snippet || lead.category || '',
        isVerified: Boolean(lead.email || lead.emails?.[0] || lead.phone || lead.website),
        trustScore,
        verificationNotes: uniqueLeadInsights(lead),
        lat: lead.lat,
        lng: lead.lng,
        metadata: {
          originalSource: lead.source || 'unknown',
          originalCategory: lead.category || '',
          rating: lead.rating || null,
          finderSnippet: lead.snippet || '',
          qualification: lead.qualification || null,
        }
      });
      if (error) throw new Error(error);
      if (savedLead?.id) {
        await leadService.enrichLead(savedLead.id, user.id);
      }
      setSavedIds(prev => new Set([...prev, idx]));
      if (!quiet) toast.success(`Saved ${lead.business_name} with enrichment`);
      return true;
    } catch (error) {
      if (!quiet) {
        toast.error(error instanceof Error ? error.message : 'Failed to save lead');
      }
      return false;
    }
  };

  const buildNoLeadsErrorMessage = (sourceErrors?: Record<string, string>) => {
    const failedSources = Object.entries(sourceErrors || {})
      .filter(([, message]) => Boolean(message))
      .map(([source]) => source.toUpperCase());

    if (failedSources.length === 0) {
      return 'No leads found. Try a broader location or a different industry.';
    }

    return `No leads found. Sources with errors: ${failedSources.join(', ')}. Check API keys and browser configuration, then try again.`;
  };

  const persistSearchHistory = (searchLeads: ScrapedLead[]) => {
    const entry: MapSearchHistoryEntry = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      niche,
      location: effectiveLocation || location || 'Global',
      radiusKm: effectiveRadiusKm,
      leadCount: searchLeads.length,
      mappedLeadCount: searchLeads.filter((l) => l.lat != null && l.lng != null).length,
      leads: searchLeads,
    };
    setMapHistory((prev) => [entry, ...prev].slice(0, 25));
  };

  const isBroadLocation = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (normalized.includes(',')) return false;
    return (
      normalized === 'global' ||
      normalized === 'world' ||
      normalized === 'worldwide' ||
      (normalized.split(/\s+/).length <= 2 && !normalized.includes(',')) ||
      normalized.length <= 3 ||
      /country|nation|region/.test(normalized)
    );
  };

  const locationNeedsCityRefinement = isBroadLocation(location);
  const effectiveLocation = locationNeedsCityRefinement && specificCity.trim()
    ? `${specificCity.trim()}, ${location.trim()}`
    : location.trim();
  const effectiveRadiusKm = Math.min(Math.max(Number(searchRadiusKm) || 25, 1), 100);
  const shouldForceCity = locationNeedsCityRefinement && (geocodePreview?.type === 'country' || geocodePreview?.type === 'administrative');

  const densityEstimate = useMemo(() => {
    const matches = mapHistory.filter((entry) =>
      entry.location.toLowerCase().includes((effectiveLocation || location || '').toLowerCase()) ||
      (effectiveLocation || location || '').toLowerCase().includes(entry.location.toLowerCase())
    );
    if (matches.length === 0) return null;
    const avg = Math.round(matches.reduce((acc, item) => acc + item.leadCount, 0) / matches.length);
    return { averageLeads: avg, samples: matches.length };
  }, [mapHistory, effectiveLocation, location]);

  useEffect(() => {
    const query = (effectiveLocation || location).trim();
    if (!query) {
      setGeocodePreview(null);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        setGeocodeLoading(true);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
          { headers: { Accept: 'application/json' } }
        );
        const data = await response.json();
        const first = Array.isArray(data) ? data[0] : null;
        if (!first) {
          setGeocodePreview(null);
          return;
        }
        setGeocodePreview({
          lat: Number(first.lat),
          lng: Number(first.lon),
          displayName: String(first.display_name || query),
          type: String(first.type || ''),
        });
      } catch {
        setGeocodePreview(null);
      } finally {
        setGeocodeLoading(false);
      }
    }, 450);
    return () => clearTimeout(timeout);
  }, [effectiveLocation, location]);

  useEffect(() => {
    if (!locationNeedsCityRefinement || specificCity.trim().length < 2 || !location.trim()) {
      setCitySuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const q = `${specificCity.trim()}, ${location.trim()}`;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(q)}&limit=5`,
          { headers: { Accept: 'application/json' } }
        );
        const data = await response.json();
        const suggestions = (Array.isArray(data) ? data : [])
          .map((item: any) => String(item.display_name || ''))
          .filter(Boolean);
        setCitySuggestions(Array.from(new Set(suggestions)).slice(0, 5));
      } catch {
        setCitySuggestions([]);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [locationNeedsCityRefinement, specificCity, location]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche) return toast.error('Please select an industry');
    if (shouldForceCity && !specificCity.trim()) {
      toast.error('Please add an exact city for broad locations and try again.');
      return;
    }
    const duplicateHistory = mapHistory.find(
      (entry) =>
        entry.niche.toLowerCase() === niche.toLowerCase() &&
        entry.location.toLowerCase() === (effectiveLocation || location || 'global').toLowerCase()
    );
    if (duplicateHistory) {
      const proceed = window.confirm(
        `You already searched this location on ${new Date(duplicateHistory.createdAt).toLocaleString()} and found ${duplicateHistory.leadCount} leads. Continue anyway?`
      );
      if (!proceed) return;
    }

    // Validate functions are available before proceeding
    if (typeof startTask !== 'function') {
        toast.error('Background task service is not available. Please refresh the page.');
        return;
    }

    setScanning(true); setResults([]); setSourceStats({}); setSavedIds(new Set()); setFallbackUsed(false); clearFilters();
    setProgress({ percent: 8, message: 'Creating search job...' });

    const taskId = `omni_search_${Date.now()}`;
    const taskName = `Finding ${niche} leads in ${effectiveLocation || 'Global'}`;
    startTask(taskId, taskName, async () => {
      try {
        const createRes = await fetch('/api/scraper/jobs/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            niche,
            location: effectiveLocation,
            sortBy: sortMode,
            usePlaywright,
            radiusKm: effectiveRadiusKm,
            tenantId: currentTenant?.id || '',
          }),
        });

        if (!createRes.ok) {
          const errData = await createRes.json();
          if (createRes.status === 503 && errData?.code === 'LEAD_QUEUE_NOT_READY') {
            setProgress({ percent: 18, message: 'Queue not ready, running direct search...' });
            const directRes = await fetch('/api/scraper/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                niche,
                location: effectiveLocation,
                sortBy: sortMode,
                radiusKm: effectiveRadiusKm,
                tenantId: currentTenant?.id || '',
              }),
            });
            const directData = await directRes.json().catch(() => ({}));
            if (!directRes.ok || !directData?.success) {
              throw new Error(directData?.error || 'Direct lead search failed');
            }

            const immediateLeads: ScrapedLead[] = Array.isArray(directData?.results)
              ? directData.results
              : [];
            const qualifiedImmediate = immediateLeads.map((lead) => ({
              ...lead,
              qualification: qualifyLead(lead, niche),
            }));
            if (qualifiedImmediate.length === 0) {
              throw new Error(buildNoLeadsErrorMessage(directData?.sourceErrors));
            }
            setResults(qualifiedImmediate);
            setSourceStats(directData?.sources || {});
            setFallbackUsed(Boolean(directData?.fallbackUsed));
            setSelectedSet(new Set());
            setViewMode('map');
            setMapCollapsed(false);
            persistSearchHistory(qualifiedImmediate);
            if (autoSave) {
              let savedCount = 0;
              for (const [index, qualifiedLead] of qualifiedImmediate.entries()) {
                const saved = await saveEnrichedLead(qualifiedLead, index, true);
                if (saved) savedCount += 1;
              }
              if (savedCount > 0) {
                toast.success(`Auto-saved ${savedCount} enriched leads`);
              }
            }
            setProgress({ percent: 100, message: 'Done' });
            toast.success(`Found ${qualifiedImmediate.length} leads`);
            return { leads: immediateLeads, sourceStats: directData?.sources || {} };
          }
          throw new Error(errData.error || 'Failed to create lead search job');
        }

        const createData = await createRes.json();
        const jobId = createData?.job?.id as string | undefined;
        if (!jobId) throw new Error('Lead search job id missing');

        let done = false;
        let latestJob: any = createData.job;

        while (!done) {
          const stepRes = await fetch(`/api/scraper/jobs/${jobId}/step`, { method: 'POST' });
          if (!stepRes.ok) {
            const errData = await stepRes.json().catch(() => ({}));
            throw new Error(errData.error || 'Lead job processing failed');
          }
          const stepData = await stepRes.json();
          latestJob = stepData.job;

          const partialLeads: ScrapedLead[] = Array.isArray(latestJob?.partial_results) ? latestJob.partial_results : [];
          const qualifiedPartial = partialLeads.map((lead) => ({
            ...lead,
            qualification: qualifyLead(lead, niche),
          }));
          setResults(qualifiedPartial);
          setSourceStats(latestJob?.source_stats || {});
          setFallbackUsed(!!latestJob?.fallback_used);
          setProgress({
            percent: Number(latestJob?.progress || 0),
            message:
              latestJob?.current_step === 'init' ? 'Collecting OSM leads...' :
              latestJob?.current_step === 'fallbacks' ? 'Collecting fallback leads...' :
              latestJob?.current_step === 'browser' ? 'Collecting browser leads...' :
              latestJob?.current_step === 'finalize' ? 'Finalizing lead list...' : 'Processing...',
          });

          if (latestJob?.status === 'completed') {
            const finalLeads: ScrapedLead[] = Array.isArray(latestJob?.final_results) ? latestJob.final_results : qualifiedPartial;
            const qualifiedFinal = finalLeads.map((lead) => ({
              ...lead,
              qualification: qualifyLead(lead, niche),
            }));
            if (qualifiedFinal.length === 0) {
              throw new Error(buildNoLeadsErrorMessage(latestJob?.source_errors));
            }
            setResults(qualifiedFinal);
            setSelectedSet(new Set());
            setViewMode('map');
            setMapCollapsed(false);
            persistSearchHistory(qualifiedFinal);
            if (autoSave) {
              let savedCount = 0;
              for (const [index, qualifiedLead] of qualifiedFinal.entries()) {
                const saved = await saveEnrichedLead(qualifiedLead, index, true);
                if (saved) savedCount += 1;
              }
              if (savedCount > 0) {
                toast.success(`Auto-saved ${savedCount} enriched leads`);
              }
            }
            setProgress({ percent: 100, message: 'Done' });
            toast.success(`Found ${qualifiedFinal.length} leads`);
            done = true;
          } else if (latestJob?.status === 'failed' || latestJob?.status === 'cancelled') {
            throw new Error(latestJob?.error_message || 'Lead search job failed');
          } else {
            await new Promise((resolve) => setTimeout(resolve, 900));
          }
        }

        return { leads: latestJob?.final_results || latestJob?.partial_results || [], sourceStats: latestJob?.source_stats || {} };
      } catch (err: any) {
        toast.error(err.message || 'Search failed');
        throw err;
      } finally {
        setTimeout(() => setScanning(false), 600);
      }
    });
  };

  // ── Render ──────────────────────────────────────────
  return (
    <div className="w-full space-y-5">

      <AnimatePresence>
        {showOutreach && selectedLeads.length > 0 && (
          <OutreachPanel
            leads={selectedLeads.map(l => ({ ...l, qualification: l.qualification! }))}
            industry={niche}
            onClose={() => setShowOutreach(false)}
          />
        )}
      </AnimatePresence>

      <div className="p-3 sm:p-4 bg-gradient-to-r from-teal-900/40 via-slate-900/50 to-slate-900 rounded-xl border border-teal-500/20 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-[10px] font-bold tracking-wider uppercase mb-1">
              <Zap className="w-2.5 h-2.5 fill-current shrink-0" /> Enterprise Engine
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-200 to-emerald-300 break-words">
              AlphaClone Business Lead
            </h1>
            <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 leading-relaxed">
              Primary: <span className="text-emerald-400 font-semibold">OpenStreetMap</span> · Fallbacks: Yelp · HERE · Browser (remote CDP / Browserbase)
              {fallbackUsed && <span className="block sm:inline sm:ml-2 text-amber-400">Fallback sources used</span>}
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto sm:items-end shrink-0">
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
            {dailyQuota && (
              <div className="flex flex-wrap items-center gap-2 text-[10px] w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-slate-500 shrink-0">Daily quota:</span>
                <div className="flex-1 sm:flex-initial min-w-[5rem] sm:w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      dailyQuota.remaining <= 20 ? 'bg-rose-500' :
                      dailyQuota.remaining <= 100 ? 'bg-amber-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${((dailyQuota.limit - dailyQuota.remaining) / dailyQuota.limit) * 100}%` }}
                  />
                </div>
                <span className={`font-bold ${
                  dailyQuota.remaining <= 20 ? 'text-rose-400' :
                  dailyQuota.remaining <= 100 ? 'text-amber-400' : 'text-teal-400'
                }`}>
                  {dailyQuota.remaining}/{dailyQuota.limit} left
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3 h-3 text-teal-400" /> Industry *
            </label>
            <IndustrySelect value={niche} onChange={setNiche} disabled={scanning} />
          </div>
          <div className="space-y-1.5 flex-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-teal-400" /> Location (Street, City, or Global)
            </label>
            <div className="relative group">
              <input
                type="text"
                placeholder='e.g. "Main St, London", "California", or "Global"'
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={scanning}
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all pr-12 hover:border-slate-600 shadow-inner"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                <Globe className="w-3.5 h-3.5 text-teal-400" />
              </div>
            </div>
            <p className="text-[9px] text-slate-500 italic pl-1 flex items-center gap-1">
              <Zap className="w-2 h-2" /> Supports pinpoint street-level accuracy & worldwide scraping.
            </p>
            {locationNeedsCityRefinement && (
              <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-amber-300">Precision Wizard</p>
                  <p className="text-[10px] text-slate-400">Step {wizardStep} / 4</p>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setWizardStep(step as 1 | 2 | 3 | 4)}
                      className={`text-[10px] rounded-md px-1 py-1 border ${wizardStep === step ? 'border-amber-400 text-amber-300 bg-amber-500/10' : 'border-slate-700 text-slate-500'}`}
                    >
                      {step}
                    </button>
                  ))}
                </div>
                {wizardStep === 1 && (
                  <p className="text-[11px] text-slate-300">
                    Country detected as broad search area. Select an exact city next for precise results.
                  </p>
                )}
                {wizardStep === 2 && (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={specificCity}
                      onChange={(e) => setSpecificCity(e.target.value)}
                      placeholder='Exact city (e.g. Harare)'
                      disabled={scanning}
                      className="w-full bg-slate-900/80 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
                    />
                    {citySuggestions.length > 0 && (
                      <div className="max-h-24 overflow-y-auto space-y-1">
                        {citySuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setSpecificCity(suggestion.split(',')[0])}
                            className="w-full text-left text-[10px] px-2 py-1 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {wizardStep === 3 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={100}
                      step={1}
                      value={searchRadiusKm}
                      onChange={(e) => setSearchRadiusKm(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-slate-300 w-14 text-right">{searchRadiusKm} km</span>
                  </div>
                )}
                {wizardStep === 4 && (
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <p className="flex items-center gap-1"><Target className="w-3 h-3 text-amber-300" /> Target: {effectiveLocation || 'Not set'}</p>
                    <p>Radius: {effectiveRadiusKm} km from city center</p>
                    <p>
                      Estimated density: {densityEstimate ? `${densityEstimate.averageLeads} leads average (${densityEstimate.samples} previous searches)` : 'No historical sample yet'}
                    </p>
                  </div>
                )}
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setWizardStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : prev))}
                    className="text-[10px] px-2 py-1 rounded-md border border-slate-700 text-slate-300"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep((prev) => (prev < 4 ? ((prev + 1) as 1 | 2 | 3 | 4) : prev))}
                    className="text-[10px] px-2 py-1 rounded-md border border-amber-500/40 text-amber-300"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 p-3 bg-slate-900/40 rounded-xl border border-slate-800 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 [scrollbar-width:thin] sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Sort</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-700 text-[10px] sm:text-[11px] font-semibold shrink-0">
              {([['default', 'Default'], ['rating_desc', 'Rating high'], ['rating_asc', 'Rating low']] as [SortMode, string][]).map(([mode, label]) => (
                <button key={mode} type="button" onClick={() => setSortMode(mode)}
                  className={`px-2 sm:px-2.5 py-1.5 sm:py-1 whitespace-nowrap transition-all ${sortMode === mode ? 'bg-teal-500 text-white' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 cursor-pointer select-none shrink-0" onClick={() => setAutoSave(v => !v)}>
            <div className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${autoSave ? 'bg-teal-500' : 'bg-slate-700'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${autoSave ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className={`text-[11px] font-bold ${autoSave ? 'text-teal-400' : 'text-slate-500'}`}>
              <Save className="w-3 h-3 inline mr-1" />Auto-save enriched leads
            </span>
          </div>

          <div className="flex items-center gap-2 cursor-pointer select-none shrink-0" onClick={() => !scanning && setUsePlaywright(v => !v)}>
            <div className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${usePlaywright ? 'bg-amber-500' : 'bg-slate-700'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${usePlaywright ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className={`text-[11px] font-bold ${usePlaywright ? 'text-amber-400' : 'text-slate-500'}`}>
              <Zap className="w-3 h-3 inline mr-1" />Power Mode
            </span>
          </div>
        </div>

        <button type="submit" disabled={scanning || !niche}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
          {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          {scanning ? 'Scanning directories...' : 'Deploy Universal Search Engine'}
        </button>
      </form>

      <AnimatePresence>
        {scanning && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            <div className="mb-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2">
              <div className="relative h-4 overflow-hidden">
                <motion.div
                  className="absolute top-0 left-0 w-4 h-4 rounded-full bg-cyan-400/80"
                  animate={{ x: ['0%', '95%', '0%'] }}
                  transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                />
                <div className="absolute top-1.5 left-0 right-0 h-1 bg-cyan-500/20 rounded-full" />
              </div>
              <p className="mt-1 text-[10px] text-cyan-300">Mission mode active: scanning territory and building lead route.</p>
            </div>
            <div className="flex justify-between text-[11px] mb-2">
              <span className="text-teal-300 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin text-emerald-400" /> {progress.message}</span>
              <span className="text-white font-mono font-bold">{progress.percent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <motion.div className="bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 h-full rounded-full"
                animate={{ width: `${progress.percent}%` }} transition={{ duration: 0.4 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {results.length > 0 && (
        <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-xs font-bold text-slate-300">Filter Results</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-teal-500 text-slate-950 text-[10px] font-black flex items-center justify-center">{activeFilterCount}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span>Total: <b className="text-white">{results.length}</b></span>
              <span>Showing: <b className="text-teal-400">{filteredResults.length}</b></span>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-rose-400 hover:text-rose-300"><X className="w-3 h-3" /> Clear</button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 min-w-0">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Search results</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input type="text" placeholder="Search business name, email, phone, address..."
                  value={filterText} onChange={e => setFilterText(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-slate-200 focus:ring-1 focus:ring-teal-500/30 focus:border-teal-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qualification</label>
              <div className="flex flex-wrap gap-1">
                {(['all','hot','warm','cold','skip'] as const).map(tier => (
                  <button key={tier} onClick={() => setFilterTier(tier)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
                      filterTier === tier ? 'bg-teal-500/20 border-teal-500/40 text-teal-300' : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                    }`}>
                    {tier === 'all' ? 'All' : tier === 'hot' ? 'Hot' : tier === 'warm' ? 'Warm' : tier === 'cold' ? 'Cold' : 'Skip'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Source</label>
              <div className="flex flex-wrap gap-1">
                {(['all', 'osm', 'google', 'yelp', 'here', 'browser'] as SourceFilter[]).map(src => (
                  <button key={src} onClick={() => setFilterSource(src)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all border ${filterSource === src ? 'bg-teal-500/20 border-teal-500/40 text-teal-300' : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'}`}>
                    {src === 'all'
                      ? 'All'
                      : src === 'osm'
                        ? 'OSM'
                        : src === 'yelp'
                          ? 'Yelp'
                          : src === 'google'
                            ? 'Google'
                          : src === 'here'
                            ? 'HERE'
                            : 'Browser'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Min Rating</label>
              <div className="flex items-center gap-1">
                {[0,1,2,3,4,5].map(r => (
                  <button key={r} onClick={() => setFilterRating(r === filterRating ? 0 : r)}
                    className={`px-1.5 py-1 rounded text-[10px] font-bold transition-all border ${filterRating === r ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                    {r === 0 ? 'Any' : `${r}★`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Has</label>
              <div className="flex flex-col gap-1.5">
                {([['filterPhone', filterPhone, setFilterPhone, <Phone key="p" className="w-3 h-3" />, 'Phone'] as const,
                   ['filterEmail', filterEmail, setFilterEmail, <Mail key="m" className="w-3 h-3" />, 'Email'] as const]).map(([key, val, setter, icon, label]) => (
                  <button key={key} type="button" onClick={() => setter(!val)}
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${val ? 'bg-teal-500/10 border-teal-500/30 text-teal-300' : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'}`}>
                    {icon} {label}
                    {val && <CheckCircle2 className="w-3 h-3 ml-auto text-teal-400" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center pt-1 border-t border-slate-800/50 flex-wrap">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <button onClick={selectAll} className="text-[10px] text-teal-400 hover:text-teal-300 font-bold">Select all</button>
              {selectedSet.size > 0 && (
                <>
                  <span className="text-slate-600">|</span>
                  <button onClick={clearSelected} className="text-[10px] text-slate-500 hover:text-slate-300">Clear ({selectedSet.size})</button>
                  <button
                    onClick={() => setShowOutreach(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold rounded-lg transition-all shadow-lg shadow-teal-500/10"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Bulk AI Outreach ({selectedSet.size})
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-1 bg-slate-950/70 rounded-lg p-0.5 border border-slate-800 self-start sm:self-auto shrink-0">
              {(['grid', 'map'] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === mode ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
                  {mode === 'grid' ? <><LayoutGrid className="w-3.5 h-3.5" /> Grid</> : <><Map className="w-3.5 h-3.5" /> Map</>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {mapHistory.length > 0 && (
        <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-teal-400" />
              <p className="text-xs font-bold text-slate-300">Map Search History</p>
            </div>
            <button
              type="button"
              onClick={() => setMapHistory([])}
              className="text-[11px] text-slate-500 hover:text-rose-400"
            >
              Clear history
            </button>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {mapHistory.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-white font-semibold truncate">
                    {entry.niche} in {entry.location}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(entry.createdAt).toLocaleString()} | Radius {entry.radiusKm}km | Leads {entry.leadCount} ({entry.mappedLeadCount} mapped)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setResults(entry.leads);
                    setViewMode('map');
                    setMapCollapsed(false);
                    setFilterText('');
                    setFilterSource('all');
                    setFilterRating(0);
                    setFilterPhone(false);
                    setFilterEmail(false);
                    setFilterTier('all');
                    toast.success('Loaded map history snapshot.');
                  }}
                  className="px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] text-slate-200 hover:bg-slate-800"
                >
                  Open on map
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {geocodePreview && !scanning && (
        <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-300">Geocode preview before search</p>
            <p className="text-[10px] text-slate-500">{geocodeLoading ? 'Resolving...' : geocodePreview.type || 'location'}</p>
          </div>
          <p className="text-[11px] text-slate-400">{geocodePreview.displayName}</p>
          <LeadMapView
            leads={[]}
            center={[geocodePreview.lat, geocodePreview.lng]}
            zoom={11}
            previewCenter={[geocodePreview.lat, geocodePreview.lng]}
            previewRadiusKm={effectiveRadiusKm}
          />
        </div>
      )}

      {viewMode === 'map' && filteredResults.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-2">
            <p className="text-xs text-slate-400">Interactive map results</p>
            <button
              type="button"
              onClick={() => setMapCollapsed((prev) => !prev)}
              className="text-xs px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            >
              {mapCollapsed ? 'Expand map' : 'Minimize map'}
            </button>
          </div>
          {!mapCollapsed && (
            <>
              <LeadMapView leads={filteredResults} />
              {filteredResults.filter(l => !l.lat).length > 0 && (
                <p className="text-[10px] text-slate-500 text-center">
                  {filteredResults.filter(l => !l.lat).length} leads without coordinates hidden from map
                </p>
              )}
            </>
          )}
        </div>
      )}

      {viewMode === 'grid' && filteredResults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredResults.map((lead, idx) => {
            const domain     = getHostname(lead.website);
            const email      = lead.email || lead.emails?.[0] || '';
            const isSaved    = savedIds.has(idx);
            const isSelected = selectedSet.has(idx);
            const qual       = lead.qualification;
            return (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.018 }}
                className={`group bg-slate-900/60 border rounded-xl p-3.5 hover:bg-slate-800/70 transition-all duration-200 flex flex-col shadow cursor-pointer ${
                  isSelected ? 'border-teal-500/60 ring-1 ring-teal-500/20 bg-slate-800/60' : 'border-slate-800 hover:border-teal-500/40'
                }`}
                onClick={() => toggleSelect(idx)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-teal-500 border-teal-500' : 'border-slate-600 group-hover:border-teal-500/50'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <div className="border border-slate-700 group-hover:border-teal-500/50 rounded-lg p-0.5 bg-slate-800 flex-shrink-0 transition-colors">
                      <Avatar name={lead.business_name} size={26} shape="rounded" className="rounded-md" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-semibold text-sm leading-tight truncate group-hover:text-teal-300 transition-colors">{lead.business_name}</h3>
                      {domain && (
                        <a href={lead.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                           className="text-slate-500 text-[10px] hover:text-teal-400 flex items-center gap-1 mt-0.5 transition-colors truncate">
                          <Globe className="w-2.5 h-2.5 flex-shrink-0" /> {domain}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-1 flex-shrink-0">
                    {lead.source && (
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${SOURCE_COLORS[lead.source] || ''}`}>
                        {lead.source}
                      </span>
                    )}
                    {qual && (
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border ${qual.bgColor} ${qual.borderColor} ${qual.color}`}>
                        {qual.label} · {qual.score}
                      </span>
                    )}
                  </div>
                </div>

                {qual && qual.insights.length > 0 && (
                  <div className="mb-2 space-y-0.5">
                    {qual.insights.slice(0, 2).map((insight, i) => (
                      <p key={i} className="text-[9px] text-slate-500 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" /> {insight}
                      </p>
                    ))}
                  </div>
                )}

                {lead.rating && <div className="mb-1.5"><StarRating rating={lead.rating} /></div>}
                {lead.category && <p className="text-[10px] text-slate-500 truncate mb-1.5">{lead.category}</p>}

                <div className="flex-grow space-y-1.5 py-2 border-t border-slate-800/50">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    {email
                      ? <span className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20 truncate">{email}</span>
                      : <span className="text-[10px] text-slate-600 italic">No email — phone outreach</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    <span className="text-[10px] text-slate-300 truncate">{lead.phone || <span className="text-slate-600 italic">No phone</span>}</span>
                  </div>
                  {lead.address && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                      <span className="text-[10px] text-slate-400 leading-tight line-clamp-2">{lead.address}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-1.5 mt-2.5" onClick={e => e.stopPropagation()}>
                  <button onClick={() => saveEnrichedLead(lead, idx)} disabled={isSaved}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded-lg border transition-all ${
                      isSaved
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default'
                        : 'hover:bg-teal-600/20 text-teal-400 hover:text-teal-300 border-teal-500/20 hover:border-teal-500/40'
                    }`}>
                    {isSaved ? <><CheckCircle2 className="w-3 h-3" /> Saved</> : <><Plus className="w-3 h-3" /> CRM</>}
                  </button>
                  {email && (
                    <button
                      onClick={() => { setSelectedSet(new Set([idx])); setShowOutreach(true); }}
                      title="Quick AI outreach"
                      className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold rounded-lg border border-teal-500/20 text-teal-400 hover:border-teal-500/50 hover:bg-teal-500/10 transition-all"
                    >
                      <Sparkles className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {!scanning && results.length > 0 && filteredResults.length === 0 && (
        <div className="text-center py-10 text-slate-500">
          <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No results match your filters.</p>
          <button onClick={clearFilters} className="mt-2 text-xs text-teal-400 hover:underline">Clear all filters</button>
        </div>
      )}
    </div>
  );
}
