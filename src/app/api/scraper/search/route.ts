import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { RouteAuthError, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { dedupeLeadsAgainstTenantHistory } from '@/lib/scraper/serverDedupe';
import { scraperSearchSchema } from '@/schemas/validation';
import { enrichLeadWebsite } from '@/lib/scraper/enrichmentPipeline';
import { waitUntil } from '@vercel/functions';
import { checkBotId } from 'botid/server';

const SOURCE_UNAVAILABLE = 'This source could not return results. Try again or adjust your query.';
import {
  fetchSerpLeadsViaBrowser,
  hasRemoteBrowserConfigured,
} from '@/lib/scraper/browserSerpLeads';
import { freePlacesService } from '@/services/freePlacesService';

export const runtime = 'nodejs';
export const maxDuration = 800;
const REQUEST_BUDGET_MS = 780000;

// ─── Per-tenant in-process quota cache ────────────────────────────────────────
// key = `${tenantId}:${YYYY-MM-DD}`, value = count of leads already returned today
// This is a fast in-memory layer — Supabase is the durable store.
const quotaCache = new Map<string, number>();

const LEADS_PER_SEARCH  = 20;   // default target per search
const MAX_LEADS_BROAD    = 100;  // extended limit for global/broad searches
const DAILY_LEAD_LIMIT  = 300;  // per-tenant / per-day ceiling

// ─── Supabase admin client for quota writes ────────────────────────────────────
function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Shared Types ──────────────────────────────────────────────────────────────
export interface LeadResult {
  business_name: string;
  website:       string;
  snippet:       string;
  phone?:        string;
  email?:        string;
  address?:      string;
  rating?:       number;
  category?:     string;
  source:        'firecrawl' | 'here' | 'osm' | 'browser';
  lat?:          number;
  lng?:          number;
  hasContact:    boolean;   // true = phone OR email present
  country_code?: string;
}

// ─── Contact quality guard ─────────────────────────────────────────────────────
// A lead is only viable if it has at least a phone number OR an email address.
function hasContactInfo(r: Partial<LeadResult>): boolean {
  const phone = (r.phone || '').trim();
  const email = (r.email || '').trim();
  const website = (r.website || '').trim();
  const hasWebsite = website.length > 0 && /^https?:\/\//i.test(website);
  return phone.length > 0 || email.length > 0 || hasWebsite;
}

function enrichWithContactFlag(leads: Array<Omit<LeadResult, 'hasContact'> & Partial<Pick<LeadResult, 'hasContact'>>>): LeadResult[] {
  return leads.map((l) => ({ ...l, hasContact: hasContactInfo(l) }));
}

// ─── Strategy 2a: HERE Maps Places (primary when key is set in Vercel) ──────
async function fetchHERE(niche: string, location: string, limit = 50, radiusKm = 25): Promise<LeadResult[]> {
  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) throw new Error('HERE API key not configured');

  const geoRes = await fetch(
    `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(location || 'New York')}&apiKey=${apiKey}`,
    { 
      headers: { 'User-Agent': 'AlphaClone-LeadFinder/2.0' },
      signal: AbortSignal.timeout(8000) 
    }
  );
  if (!geoRes.ok) throw new Error(`HERE Geocode error: ${geoRes.status}`);
  const geoData = await geoRes.json();
  const pos = geoData.items?.[0]?.position;
  if (!pos) throw new Error('HERE: could not geocode location');

  const radiusM = Math.min(Math.max(radiusKm * 1000, 1000), 100000);
  const searchRes = await fetch(
    `https://discover.search.hereapi.com/v1/discover?q=${encodeURIComponent(niche)}&at=${pos.lat},${pos.lng}&in=circle:${pos.lat},${pos.lng};r=${radiusM}&limit=${Math.min(limit, 100)}&apiKey=${apiKey}`,
    { 
      headers: { 'User-Agent': 'AlphaClone-LeadFinder/2.0' },
      signal: AbortSignal.timeout(12000) 
    }
  );
  if (!searchRes.ok) throw new Error(`HERE Discover error: ${searchRes.status}`);
  const searchData = await searchRes.json();

  return (searchData.items || [])
    .filter((item: any) => item.title)
    .map((item: any): LeadResult => ({
      business_name: item.title,
      website:       item.contacts?.[0]?.www?.[0]?.value || '',
      snippet:       item.categories?.[0]?.name || 'Business',
      phone:         item.contacts?.[0]?.phone?.[0]?.value || '',
      email:         item.contacts?.[0]?.email?.[0]?.value || '',
      address:       item.address?.label || '',
      rating:        undefined,
      category:      item.categories?.[0]?.name || '',
      source:        'here',
      lat:           item.position?.lat,
      lng:           item.position?.lng,
      hasContact:    false,
      country_code:  item.address?.countryCode,
    }));
}

// ─── Strategy 2b: Foursquare Places API (FREE fallback when HERE key missing) ─
// Free tier: 1,000 calls/day — foursquare.com/developers
async function fetchFoursquare(niche: string, location: string, limit = 20, radiusKm = 25): Promise<LeadResult[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) throw new Error('FOURSQUARE_API_KEY not configured');

  // Geocode with Nominatim (free)
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location || 'United States')}&format=json&limit=1`,
    {
      headers: { 'User-Agent': 'AlphaClone-LeadFinder/2.0 (support@alphaclonesystems.com)' },
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!geoRes.ok) throw new Error(`Foursquare geocode failed: ${geoRes.status}`);
  const geoData = await geoRes.json();
  if (!geoData?.[0]) throw new Error(`Foursquare: could not geocode "${location}"`);
  const lat = parseFloat(geoData[0].lat);
  const lng = parseFloat(geoData[0].lon);

  const radiusM = Math.min(Math.max(radiusKm * 1000, 100), 100000);
  const url = new URL('https://api.foursquare.com/v3/places/search');
  url.searchParams.set('query', niche);
  url.searchParams.set('ll', `${lat},${lng}`);
  url.searchParams.set('radius', String(radiusM));
  url.searchParams.set('limit', String(Math.min(limit, 50)));
  url.searchParams.set('fields', 'fsq_id,name,location,tel,website,categories,geocodes,rating,stats');

  const searchRes = await fetch(url.toString(), {
    headers: { Accept: 'application/json', Authorization: apiKey },
    signal: AbortSignal.timeout(12000),
  });
  if (!searchRes.ok) throw new Error(`Foursquare search error ${searchRes.status}`);
  const data = await searchRes.json();

  return (data.results || []).map((place: any): LeadResult => {
    const addr = place.location;
    const addressStr = [addr?.address, addr?.locality, addr?.region, addr?.country].filter(Boolean).join(', ');
    return {
      business_name: place.name || 'Unknown',
      website:       place.website || '',
      snippet:       place.categories?.[0]?.name || 'Business',
      phone:         place.tel || '',
      email:         '',
      address:       addressStr,
      rating:        typeof place.rating === 'number' ? place.rating / 2 : undefined,
      category:      place.categories?.[0]?.name || '',
      source:        'here' as const, // reuse 'here' source slot for backwards compat
      lat:           place.geocodes?.main?.latitude ?? lat,
      lng:           place.geocodes?.main?.longitude ?? lng,
      hasContact:    false,
      country_code:  place.location?.country,
    };
  });
}

// ─── Strategy 2b: DuckDuckGo HTML SERP (zero cost, no API key) ────────────────
// Replaces Firecrawl when its key is not configured
async function fetchDuckDuckGoLeads(niche: string, location: string, limit = 20): Promise<LeadResult[]> {
  const query = `${niche} ${location} business contact phone email`;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`DuckDuckGo HTML returned ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const results: LeadResult[] = [];
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,}\d{3,4}/;

  $('.result, .web-result').each((_, el) => {
    if (results.length >= limit) return false;
    const titleEl = $(el).find('.result__title, .result__a').first();
    const name = titleEl.text().replace(/\s+[-|].*$/, '').trim();
    if (!name || name.length < 2) return;

    const link = $(el).find('a.result__url, a.result__a').attr('href') || '';
    const snippet = $(el).find('.result__snippet').text().trim();
    const allText = `${snippet} ${name}`;

    let website = '';
    try {
      const parsed = new URL(link.startsWith('//duckduckgo') ? `https:${link}` : link);
      const uddg = parsed.searchParams.get('uddg');
      website = uddg ? decodeURIComponent(uddg) : parsed.origin;
    } catch { website = link; }

    const phone = allText.match(PHONE_RE)?.[0]?.trim() || '';
    const email = allText.match(EMAIL_RE)?.[0]?.toLowerCase() || '';

    results.push({
      business_name: name,
      website,
      snippet: snippet || 'Found via web search',
      phone,
      email,
      address: '',
      rating: undefined,
      category: 'Web result',
      source: 'firecrawl' as const, // reuse 'firecrawl' source slot
      hasContact: !!(phone || email || website),
    });
  });

  return results;
}

// ─── Strategy: Free Places Fallback (Foursquare + OSM, zero cost) ─────────────
async function fetchFreePlacesFallback(niche: string, location: string, limit = 20, radiusKm = 40): Promise<LeadResult[]> {
  const res = await freePlacesService.searchPlacesForLeads(niche, location || 'United States', undefined, {
    radiusKm: Math.min(Math.max(radiusKm, 1), 100),
    maxResults: Math.min(limit, 50),
  });

  if (res.error && res.places.length === 0) {
    throw new Error(res.error);
  }

  return res.places.map(
    (p): LeadResult => ({
      business_name: p.businessName,
      website: p.website || '',
      snippet: p.industry || 'Business',
      phone: p.phone || '',
      email: '',
      address: p.formattedAddress || '',
      rating: p.rating,
      category: p.industry || '',
      source: 'osm' as const, // reuse 'osm' source slot for display
      lat: p.lat,
      lng: p.lng,
      hasContact: false,
      country_code: p.countryCode,
    })
  );
}

// ─── Overpass API mirrors (rotate on 429 / timeout; public instances are rate-limited) ──
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

class OverpassRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OverpassRequestError';
    this.status = status;
  }
}

async function postOverpassQuery(queryBody: string): Promise<Response> {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt < 1; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          body: queryBody,
          headers: { 
            'Content-Type': 'text/plain',
            'User-Agent': 'AlphaClone-LeadFinder/2.0 (support@alphaclonesystems.com)'
          },
          signal: AbortSignal.timeout(6000),
        });
        if (res.status === 429) {
          throw new OverpassRequestError('Overpass 429', 429);
        }
        if (!res.ok) {
          lastError = new OverpassRequestError(`Overpass ${res.status}`, res.status);
          continue;
        }
        return res;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (lastError instanceof OverpassRequestError && lastError.status === 429) {
          // All public mirrors are usually throttling together; fail fast to preserve runtime budget.
          throw lastError;
        }
      }
    }
  }
  throw lastError || new OverpassRequestError('Overpass request failed');
}

// ─── Strategy 3 (PRIMARY): OpenStreetMap / Overpass ───────────────────────────
// OSM is always free. Always runs first. Widens bbox until targetMin VERIFIED leads found.
// "Verified" = has phone OR email in OSM tags.
async function fetchOpenStreetMap(niche: string, location: string, targetMin = 20, radiusKm = 25): Promise<LeadResult[]> {
  // 1. Nominatim → lat/lon (Using for free world-wide coverage)
  const isGlobal = !location || /global|world|anywhere/i.test(location);
  const geoQuery = isGlobal ? 'London, UK' : location; // Default to major hub if global
  const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoQuery)}&format=json&limit=1`;
  
  let nomData: any[] = [];
  try {
    const nomRes = await fetch(nomUrl, { 
      headers: { 'User-Agent': 'AlphaClone-LeadFinder/1.0 (support@alphaclonesystems.com)' },
      signal: AbortSignal.timeout(10000),
    });
    if (nomRes.ok) nomData = await nomRes.json();
  } catch (e) {
    console.warn('[OSM] Nominatim primary geocode failed, trying fallbacks...');
  }

  let centerLat: number;
  let centerLon: number;

  if (nomData?.[0]) {
    centerLat = parseFloat(nomData[0].lat);
    centerLon = parseFloat(nomData[0].lon);
  } else {
    // Fallback: Try HERE geocoding if available
    try {
      const hereApiKey = process.env.HERE_API_KEY;
      if (hereApiKey && !hereApiKey.startsWith('your_')) {
        const hereGeoRes = await fetch(
          `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(geoQuery)}&apiKey=${hereApiKey}`,
          { 
            headers: { 'User-Agent': 'AlphaClone-LeadFinder/2.0' },
            signal: AbortSignal.timeout(8000) 
          }
        );
        if (hereGeoRes.ok) {
          const hereData = await hereGeoRes.json();
          const pos = hereData.items?.[0]?.position;
          if (pos) {
            centerLat = pos.lat;
            centerLon = pos.lng;
          } else throw new Error('HERE geocode no results');
        } else throw new Error('HERE geocode failed');
      } else throw new Error('No HERE key');
    } catch (err) {
      throw new Error(`Location not found: "${location}". OSM and fallbacks failed to geocode.`);
    }
  }

  // 2. Adaptive Bounding Box (Progressively widen)
  // For street-level precision, we start with a very small delta (0.01 deg ~= 1km)
  // For broad queries like "California", we start much wider.
  const isBroad = isGlobal || /state|province|country|usa|uk|canada|europe/i.test(location);
  
  // If location contains a comma (likely specific address/city) or is "Global", use specialized deltas
  const baseDelta = Math.min(Math.max(radiusKm / 111, 0.01), 1.5);
  const deltas = isBroad
    ? [Math.max(baseDelta, 1.0), Math.max(baseDelta * 2, 2.5), Math.max(baseDelta * 5, 6.0)]
    : (location.includes(',')
      ? [Math.max(baseDelta * 0.4, 0.01), Math.max(baseDelta, 0.05), Math.max(baseDelta * 2, 0.15), Math.max(baseDelta * 4, 0.5)]
      : [Math.max(baseDelta, 0.15), Math.max(baseDelta * 2, 0.3), Math.max(baseDelta * 4, 0.6), Math.max(baseDelta * 8, 1.2), Math.max(baseDelta * 12, 2.5)]);
  
  let verifiedElements: any[] = [];

  const startedAt = Date.now();
  const OSM_BUDGET_MS = 14000;
  for (const delta of deltas) {
    if (Date.now() - startedAt > OSM_BUDGET_MS) {
      console.warn('[OSM] Time budget reached, returning best partial result');
      break;
    }
    const south = centerLat - delta;
    const north = centerLat + delta;
    const west  = centerLon - delta;
    const east  = centerLon + delta;

    // Increase fetch limit for broad searches to ensure density
    const fetchLimit = isBroad ? 200 : Math.max(targetMin * 4, 80);

    // International Keyword Expansion (e.g. HVAC -> Klimatyzacja, Wentylacja)
    const getExpandedNiche = (n: string) => {
      const lower = n.toLowerCase();
      const map: Record<string, string[]> = {
        'hvac': ['Klimatyzacja', 'Wentylacja', 'Air Conditioning', 'Heating'],
        'plumber': ['Hydraulik', 'Plumbing'],
        'electrician': ['Elektryk', 'Electrician'],
        'dentist': ['Stomatolog', 'Dentysta', 'Dentist'],
        'restaurant': ['Restauracja', 'Jedzenie', 'Restaurant'],
        'lawyer': ['Prawnik', 'Adwokat', 'Kancelaria'],
      };
      const extras = map[lower] || [];
      if (extras.length === 0) return n.replace(/["\\]/g, '');
      return [n, ...extras].map(s => s.replace(/["\\]/g, '')).join('|');
    };

    const nicheEscaped = getExpandedNiche(niche);

    // Extended Overpass query: match by name OR by shop/amenity/office/craft category
    // We include node, way, and relation.
    const q = `
[out:json][timeout:15];
(
  node["name"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["amenity"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["shop"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["office"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["craft"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["leisure"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["tourism"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["healthcare"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["industrial"~"${nicheEscaped}",i](${south},${west},${north},${east});
  
  way["name"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["amenity"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["shop"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["office"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["craft"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["leisure"~"${nicheEscaped}",i](${south},${west},${north},${east});
  
  relation["name"~"${nicheEscaped}",i](${south},${west},${north},${east});
  relation["amenity"~"${nicheEscaped}",i](${south},${west},${north},${east});
  relation["shop"~"${nicheEscaped}",i](${south},${west},${north},${east});
)
;
out center ${fetchLimit};
    `.trim();

    try {
      const res = await postOverpassQuery(q);
      const data = await res.json();
      const all = (data.elements || []).filter((el: any) => el.tags?.name);
      // Keep all elements that have a name and some basic classification
      verifiedElements = all;
      if (verifiedElements.length >= targetMin) break;
    } catch (err) {
      console.warn('[OSM] Overpass attempt failed, widening bbox:', err);
      if (err instanceof OverpassRequestError && err.status === 429) {
        // Avoid repeated throttled requests that can trigger serverless timeout.
        break;
      }
    }
  }

  return verifiedElements.map((el: any): LeadResult => ({
    business_name: el.tags.name,
    website:  el.tags.website || el.tags.url || el.tags['contact:website'] || '',
    snippet:  el.tags.amenity || el.tags.shop || el.tags.office || el.tags.craft || 'Local business',
    phone:    el.tags.phone || el.tags['contact:phone'] || el.tags['phone:mobile'] || '',
    email:    el.tags.email || el.tags['contact:email'] || '',
    address:  [
      el.tags['addr:housenumber'], el.tags['addr:street'],
      el.tags['addr:city'], el.tags['addr:country'],
    ].filter(Boolean).join(' '),
    rating:   undefined,
    category: el.tags.amenity || el.tags.shop || el.tags.office || '',
    source:   'osm',
    lat:      el.lat  ?? el.center?.lat,
    lng:      el.lon  ?? el.center?.lon,
    hasContact: hasContactInfo({
      phone: el.tags.phone || el.tags['contact:phone'] || el.tags['phone:mobile'] || '',
      email: el.tags.email || el.tags['contact:email'] || '',
      website: el.tags.website || el.tags.url || el.tags['contact:website'] || '',
    }),
  }));
}

// ─── Sort helper ──────────────────────────────────────────────────────────────
function sortResults(results: LeadResult[], sortBy: string): LeadResult[] {
  if (sortBy === 'rating_desc') {
    return [...results].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }
  if (sortBy === 'rating_asc') {
    return [...results].sort((a, b) => {
      if (a.rating === undefined && b.rating === undefined) return 0;
      if (a.rating === undefined) return 1;
      if (b.rating === undefined) return -1;
      return a.rating - b.rating;
    });
  }
  return results;
}

// ─── Per-tenant daily quota ───────────────────────────────────────────────────
// Each tenant has 300 verified lead slots per UTC day.
// The quota is PER TENANT — so 1000 tenants each get their own 300/day independently.
async function checkAndDeductQuota(tenantId: string, wantCount: number): Promise<{
  allowed: boolean;
  remaining: number;
  used: number;
  error?: string;
}> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD UTC
  const cacheKey = `${tenantId}:${today}`;

  // Fast path: check in-process cache first
  const cached = quotaCache.get(cacheKey) ?? 0;
  if (cached >= DAILY_LEAD_LIMIT) {
    return { allowed: false, remaining: 0, used: cached };
  }

  // Durable path: check Supabase
  const admin = getAdminSupabase();
  if (admin) {
    try {
      const { data, error } = await admin
        .from('lead_search_quota')
        .select('leads_used')
        .eq('tenant_id', tenantId)
        .eq('date', today)
        .maybeSingle();

      if (error) throw error;

      const used = data?.leads_used ?? 0;
      const remaining = DAILY_LEAD_LIMIT - used;

      if (remaining <= 0) {
        quotaCache.set(cacheKey, used);
        return { allowed: false, remaining: 0, used };
      }

      // Deduct synchronously (upsert)
      const deductCount = Math.min(wantCount, remaining);
      await admin
        .from('lead_search_quota')
        .upsert(
          { tenant_id: tenantId, date: today, leads_used: used + deductCount },
          { onConflict: 'tenant_id,date' }
        );

      // Update cache
      quotaCache.set(cacheKey, used + deductCount);

      return { allowed: true, remaining: remaining - deductCount, used: used + deductCount };
    } catch (err: unknown) {
      // If quota table doesn't exist yet, fail open (don't block searches)
      console.warn('[Quota] Supabase quota check failed — failing open:', err);
    }
  }

  // Fail open: no quota table → allow all (multi-tenant safe, just logs a warning)
  return { allowed: true, remaining: DAILY_LEAD_LIMIT - cached, used: cached };
}

// ─── Main POST Handler ─────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const requestStartedAt = Date.now();
    const isBudgetExceeded = () => Date.now() - requestStartedAt > REQUEST_BUDGET_MS;

    // Vercel BotId Protection
    const verification = await checkBotId();
    if (verification.isBot) {
      return NextResponse.json({ error: 'Bot detected. Access denied.' }, { status: 403 });
    }

    const body = await request.json();
    const fallbackNiche = body.niche || body.query?.split(' in ')[0]?.trim() || '';
    const fallbackLocation = body.location || body.query?.split(' in ')[1]?.trim() || '';
    const parsed = scraperSearchSchema.safeParse({
      niche: fallbackNiche,
      location: fallbackLocation,
      sortBy: body.sortBy || 'default',
      radiusKm: Number(body.radiusKm || 25),
      tenantId: String(body.tenantId || body.tenant_id || '').trim(),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
    }
    const { niche, location, sortBy, radiusKm, tenantId } = parsed.data;

    await requireTenantAccess(tenantId);

    // ── Per-tenant daily quota check ─────────────────────────────────────────
    let quotaInfo = { allowed: true, remaining: DAILY_LEAD_LIMIT, used: 0 };
    if (tenantId) {
      quotaInfo = await checkAndDeductQuota(tenantId, LEADS_PER_SEARCH);
      if (!quotaInfo.allowed) {
        return NextResponse.json({
          success: false,
          error: `Daily lead limit reached (${DAILY_LEAD_LIMIT} verified leads/day). Resets at midnight UTC.`,
          quota: { limit: DAILY_LEAD_LIMIT, used: quotaInfo.used, remaining: 0 },
        }, { status: 429 });
      }
    }

    const results: LeadResult[] = [];
    const sourceErrors: Record<string, string> = {};
    const sourceCounts: Record<string, number>  = { osm: 0, here: 0, firecrawl: 0, browser: 0 };

    // ── Step 1: All sources run in parallel ──────────────────────────────────
    // OSM:         free, always runs
    // HERE Maps:   runs when HERE_API_KEY is set (Vercel) → falls back to Foursquare
    // Firecrawl:   runs when FIRECRAWL_API_KEY is set (Vercel) → falls back to DuckDuckGo
    // Browser SERP: Browserbase (configured in Vercel), scrapes Bing results
    try {
      const hereKey      = process.env.HERE_API_KEY;
      const firecrawlKey = process.env.FIRECRAWL_API_KEY;

      const [osmRes, hereOrFsqRes, searchRes, browserRes] = await Promise.allSettled([
        fetchOpenStreetMap(niche, location, LEADS_PER_SEARCH, radiusKm),
        // HERE Maps when Vercel key present, Foursquare free tier as local fallback
        hereKey && !hereKey.startsWith('your_')
          ? fetchHERE(niche, location, LEADS_PER_SEARCH, radiusKm)
          : fetchFoursquare(niche, location, LEADS_PER_SEARCH, radiusKm),
        // Firecrawl when Vercel key present, DuckDuckGo HTML scrape as local fallback
        firecrawlKey
          ? import('@/services/firecrawlService').then(m => m.firecrawlService.searchLeads(`${niche} businesses in ${location} contact info`, LEADS_PER_SEARCH))
          : fetchDuckDuckGoLeads(niche, location, LEADS_PER_SEARCH),
        hasRemoteBrowserConfigured() ? fetchSerpLeadsViaBrowser(niche, location, LEADS_PER_SEARCH) : Promise.resolve([])
      ]);

      if (osmRes.status === 'fulfilled') {
        const enriched = enrichWithContactFlag(osmRes.value);
        results.push(...enriched);
        sourceCounts.osm = enriched.length;
        console.log(`[Scraper] OSM returned ${enriched.length} leads`);
      } else {
        const msg = osmRes.reason?.message || 'OSM failed';
        console.warn('[Scraper] OSM failed:', msg);
        sourceErrors.osm = msg;
      }
      if (hereOrFsqRes.status === 'fulfilled') {
        const enriched = enrichWithContactFlag(hereOrFsqRes.value);
        results.push(...enriched);
        sourceCounts.here = enriched.length;
        console.log(`[Scraper] ${hereKey ? 'HERE Maps' : 'Foursquare'} returned ${enriched.length} leads`);
      } else {
        const msg = hereOrFsqRes.reason?.message || 'Places search failed';
        console.warn(`[Scraper] ${hereKey ? 'HERE Maps' : 'Foursquare'} failed:`, msg);
        sourceErrors.here = msg;
      }
      if (searchRes.status === 'fulfilled') {
        const enriched = enrichWithContactFlag(searchRes.value as any[]);
        results.push(...enriched);
        sourceCounts.firecrawl = enriched.length;
        console.log(`[Scraper] ${firecrawlKey ? 'Firecrawl' : 'DuckDuckGo'} returned ${enriched.length} leads`);
      } else {
        const msg = searchRes.reason?.message || 'Web search failed';
        console.warn(`[Scraper] ${firecrawlKey ? 'Firecrawl' : 'DuckDuckGo'} failed:`, msg);
        sourceErrors.firecrawl = msg;
      }
      if (browserRes.status === 'fulfilled') {
        const enriched = enrichWithContactFlag(browserRes.value);
        results.push(...enriched);
        sourceCounts.browser = enriched.length;
        console.log(`[Scraper] Browser SERP returned ${enriched.length} leads`);
      } else {
        const msg = browserRes.reason?.message || 'Browser search failed';
        console.warn('[Scraper] Browser SERP failed:', msg);
        sourceErrors.browser = msg;
      }
    } catch (err: unknown) {
      console.warn('[Scraper] Primary sources failed:', err);
    }

    // ── Step 2: Free Places fallback (Foursquare+OSM via freePlacesService) ─────
    const needFallback = results.length < LEADS_PER_SEARCH;
    if (needFallback && !isBudgetExceeded()) {
      console.log(`[Scraper] After primary sources: ${results.length} leads — activating free places fallback…`);
      try {
        const want = LEADS_PER_SEARCH - results.length + 5;
        const fallbackRows = await fetchFreePlacesFallback(niche, location, want, radiusKm).catch(() => []);

        if (fallbackRows.length > 0) {
          const existingNames = new Set(results.map(r => r.business_name.toLowerCase()));
          const newRows = fallbackRows.filter(r => !existingNames.has(r.business_name.toLowerCase()));
          const enriched = enrichWithContactFlag(newRows);
          results.push(...enriched);
          sourceCounts.osm += enriched.length;
          console.log(`[Scraper] Free places fallback: ${enriched.length} unique leads`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[Scraper] Free places fallback failed:', msg);
        sourceErrors.osm_fallback = msg;
      }
    }

    if (results.length === 0) {
      const bestError = sourceErrors.search || sourceErrors.browser || sourceErrors.here || sourceErrors.osm || 'No leads found. Try a different niche or location.';
      return NextResponse.json({
        success: false,
        results: [],
        error: bestError,
        sourceErrors,
      });
    }

    // Deduplicate by normalised name
    const unique = Array.from(
      new Map(results.map(r => [(r.business_name || '').toLowerCase().trim(), r])).values()
    );

    // Apply sort
    const sorted = sortResults(unique, sortBy);
    let final = sorted.slice(0, LEADS_PER_SEARCH);

    // ── Step 5: Enrichment waterfall (only for leads missing contact info) ────
    // Runs in parallel, budget 25s total across all leads
    const ENRICH_BUDGET_MS = 25000;
    const enrichStart = Date.now();
    await Promise.allSettled(
      final
        .filter((r) => r.website && !r.phone && !r.email)
        .slice(0, 12) // increased from 6 to utilize the 800s infrastructure
        .map(async (lead) => {
          if (Date.now() - enrichStart > ENRICH_BUDGET_MS) return;
          try {
            const enriched = await enrichLeadWebsite(
              lead.website,
              ENRICH_BUDGET_MS - (Date.now() - enrichStart)
            );
            if (enriched.emails.length > 0) lead.email = enriched.emails[0];
            if (enriched.phone) lead.phone = enriched.phone;
            if (enriched.emails.length > 0 || enriched.phone) lead.hasContact = true;
          } catch {
            // silently skip — lead still goes through without enrichment
          }
        })
    );
      // Run final cleanup and history deduplication in the background via waitUntil
      // This ensures we return results immediately while still maintaining durable state
      waitUntil((async () => {
        const tenantIdForDedupe = tenantId || '';
        if (tenantIdForDedupe) {
          const adminForDedupe = getAdminSupabase();
          if (adminForDedupe) {
            await dedupeLeadsAgainstTenantHistory(adminForDedupe, tenantIdForDedupe, final);
          }
        }
        // Deduct quota for verified leads found
        if (tenantId && final.length > 0) {
            await checkAndDeductQuota(tenantId, final.length);
        }
      })());

      return NextResponse.json({
        success: true,
        results: final.map(({ source: _source, ...rest }) => rest),
        fallbackUsed: results.length < LEADS_PER_SEARCH,
        quota: tenantId ? {
          limit: DAILY_LEAD_LIMIT,
          used: quotaInfo.used,
          remaining: quotaInfo.remaining,
        } : undefined,
        leadsWithContact: final.filter((r) => r.hasContact).length,
        leadsWithoutContact: final.filter((r) => !r.hasContact).length,
      });

  } catch (error: unknown) {
    if (error instanceof RouteAuthError) {
      return routeErrorResponse(error);
    }

    console.error('[Scraper] Fatal:', error);
    return clientErrorResponse(error, { request, scope: 'scraper/search.POST' });
  }
}
