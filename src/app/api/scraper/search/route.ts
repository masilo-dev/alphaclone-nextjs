import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RouteAuthError, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  fetchSerpLeadsViaBrowser,
  hasRemoteBrowserConfigured,
} from '@/lib/scraper/browserSerpLeads';

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
  source:        'yelp' | 'here' | 'osm' | 'browser';
  lat?:          number;
  lng?:          number;
  hasContact:    boolean;   // true = phone OR email present
}

// ─── Contact quality guard ─────────────────────────────────────────────────────
// A lead is only viable if it has at least a phone number OR an email address.
function hasContactInfo(r: Partial<LeadResult>): boolean {
  const phone = (r.phone || '').trim();
  const email = (r.email || '').trim();
  return phone.length > 0 || email.length > 0;
}

function enrichWithContactFlag(leads: Array<Omit<LeadResult, 'hasContact'> & Partial<Pick<LeadResult, 'hasContact'>>>): LeadResult[] {
  return leads.map((l) => ({ ...l, hasContact: hasContactInfo(l) }));
}

// ─── Strategy 1 (Fallback): Yelp Fusion ───────────────────────────────────────
async function fetchYelp(niche: string, location: string, limit = 20, sortBy: string): Promise<LeadResult[]> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) throw new Error('Yelp API key not configured');

  const params = new URLSearchParams({
    term: niche,
    location: location || 'United States',
    limit: String(Math.min(limit, 50)),
    sort_by: 'rating',
  });

  const res = await fetch(`https://api.yelp.com/v3/businesses/search?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`Yelp API error: ${res.status} ${res.statusText}`);
  const data = await res.json();

  return (data.businesses || []).map((b: any): LeadResult => ({
    business_name: b.name,
    website:       b.url || '',
    snippet:       b.categories?.[0]?.title || 'Business',
    phone:         b.display_phone || b.phone || '',
    email:         '',   // Yelp doesn't provide email
    address:       [b.location?.address1, b.location?.city, b.location?.state, b.location?.country].filter(Boolean).join(', '),
    rating:        b.rating,
    category:      b.categories?.[0]?.title || '',
    source:        'yelp',
    lat:           b.coordinates?.latitude,
    lng:           b.coordinates?.longitude,
    hasContact:    false, // filled by enrichWithContactFlag
  }));
}

// ─── Strategy 2 (Fallback): HERE Maps Places ──────────────────────────────────
async function fetchHERE(niche: string, location: string, limit = 20): Promise<LeadResult[]> {
  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) throw new Error('HERE API key not configured');

  const geoRes = await fetch(
    `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(location || 'New York')}&apiKey=${apiKey}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!geoRes.ok) throw new Error(`HERE Geocode error: ${geoRes.status}`);
  const geoData = await geoRes.json();
  const pos = geoData.items?.[0]?.position;
  if (!pos) throw new Error('HERE: could not geocode location');

  const searchRes = await fetch(
    `https://discover.search.hereapi.com/v1/discover?q=${encodeURIComponent(niche)}&at=${pos.lat},${pos.lng}&limit=${Math.min(limit, 100)}&apiKey=${apiKey}`,
    { signal: AbortSignal.timeout(12000) }
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
    }));
}

// ─── Overpass API mirrors (rotate on 429 / timeout; public instances are rate-limited) ──
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function postOverpassQuery(queryBody: string): Promise<Response> {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          body: queryBody,
          headers: { 'Content-Type': 'text/plain' },
          signal: AbortSignal.timeout(45000),
        });
        if (res.status === 429) {
          lastError = new Error(`Overpass 429`);
          break;
        }
        if (!res.ok) {
          lastError = new Error(`Overpass ${res.status}`);
          continue;
        }
        return res;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }
  throw lastError || new Error('Overpass request failed');
}

// ─── Strategy 3 (PRIMARY): OpenStreetMap / Overpass ───────────────────────────
// OSM is always free. Always runs first. Widens bbox until targetMin VERIFIED leads found.
// "Verified" = has phone OR email in OSM tags.
async function fetchOpenStreetMap(niche: string, location: string, targetMin = 20): Promise<LeadResult[]> {
  // 1. Nominatim → lat/lon (Using for free world-wide coverage)
  const isGlobal = !location || /global|world|anywhere/i.test(location);
  const geoQuery = isGlobal ? 'London, UK' : location; // Default to major hub if global
  
  const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoQuery)}&format=json&limit=1`;
  const nomRes = await fetch(nomUrl, { 
    headers: { 'User-Agent': 'AlphaClone-LeadFinder/1.0 (support@alphaclone.tech)' },
    signal: AbortSignal.timeout(10000),
  });
  
  if (!nomRes.ok) throw new Error('Nominatim geocoding failed');
  const nomData = await nomRes.json();
  if (!nomData[0]) throw new Error(`OSM: location not found "${location}"`);

  const centerLat = parseFloat(nomData[0].lat);
  const centerLon = parseFloat(nomData[0].lon);

  // 2. Adaptive Bounding Box (Progressively widen)
  // For street-level precision, we start with a very small delta (0.01 deg ~= 1km)
  // For broad queries like "California", we start much wider.
  const isBroad = isGlobal || /state|province|country|usa|uk|canada|europe/i.test(location);
  
  // If location contains a comma (likely specific address/city) or is "Global", use specialized deltas
  const deltas = isBroad 
    ? [2.5, 5.0, 12.5] 
    : (location.includes(',') ? [0.01, 0.05, 0.15, 0.5] : [0.15, 0.3, 0.6, 1.2, 2.5]);
  
  let verifiedElements: any[] = [];

  for (const delta of deltas) {
    const south = centerLat - delta;
    const north = centerLat + delta;
    const west  = centerLon - delta;
    const east  = centerLon + delta;

    // Increase fetch limit for broad searches to ensure density
    const fetchLimit = isBroad ? 200 : Math.max(targetMin * 4, 80);
    const nicheEscaped = niche.replace(/["\\]/g, '');

    // Extended Overpass query: match by name OR by shop/amenity/office/craft category
    // We include node, way, and relation.
    const q = `
[out:json][timeout:30];
(
  node["name"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["amenity"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["shop"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["office"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["craft"~"${nicheEscaped}",i](${south},${west},${north},${east});
  
  way["name"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["amenity"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["shop"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["office"~"${nicheEscaped}",i](${south},${west},${north},${east});
  
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
      // Filter to only elements that have phone OR email in OSM tags
      verifiedElements = all.filter((el: any) => {
        const p = el.tags.phone || el.tags['contact:phone'] || el.tags['phone:mobile'] || '';
        const e = el.tags.email || el.tags['contact:email'] || '';
        return p.trim().length > 0 || e.trim().length > 0;
      });
      if (verifiedElements.length >= targetMin) break;
    } catch (err) {
      console.warn('[OSM] Overpass attempt failed, widening bbox:', err);
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
    hasContact: true, // already filtered above
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
    } catch (err: any) {
      // If quota table doesn't exist yet, fail open (don't block searches)
      console.warn('[Quota] Supabase quota check failed — failing open:', err.message);
    }
  }

  // Fail open: no quota table → allow all (multi-tenant safe, just logs a warning)
  return { allowed: true, remaining: DAILY_LEAD_LIMIT - cached, used: cached };
}

// ─── Main POST Handler ─────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const niche     = body.niche    || body.query?.split(' in ')[0]?.trim() || '';
    const location  = body.location || body.query?.split(' in ')[1]?.trim() || '';
    const sortBy    = body.sortBy   || 'default';
    const tenantId  = (body.tenantId || body.tenant_id || '').trim();

    if (!niche) {
      return NextResponse.json({ error: 'Industry/niche is required' }, { status: 400 });
    }

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
    const sourceCounts: Record<string, number>  = { osm: 0, yelp: 0, here: 0, browser: 0 };

    // ── Step 1: OSM runs FIRST (primary, always free) ─────────────────────────
    try {
      const osmResults = await fetchOpenStreetMap(niche, location, LEADS_PER_SEARCH);
      // Double-check: only keep leads with at least phone OR email
      const verified = osmResults.filter(r => hasContactInfo(r));
      results.push(...enrichWithContactFlag(verified));
      sourceCounts.osm = verified.length;
      console.log(`[Scraper] OSM returned ${osmResults.length} raw → ${verified.length} verified (with contact)`);
    } catch (err: any) {
      sourceErrors.osm = err.message;
      console.warn('[Scraper] OSM failed:', err.message);
    }

    // ── Step 2: Fallbacks only if OSM < LEADS_PER_SEARCH verified leads ───────
    const needMore = results.length < LEADS_PER_SEARCH;
    if (needMore) {
      console.log(`[Scraper] OSM only got ${results.length} verified leads — activating fallbacks…`);
      const [yelpRes, hereRes] = await Promise.allSettled([
        fetchYelp(niche, location, LEADS_PER_SEARCH - results.length + 5, sortBy),
        fetchHERE(niche, location, LEADS_PER_SEARCH - results.length + 5),
      ]);

      if (yelpRes.status === 'fulfilled') {
        const verified = yelpRes.value.filter(r => hasContactInfo(r));
        results.push(...enrichWithContactFlag(verified));
        sourceCounts.yelp = verified.length;
        const rejected = yelpRes.value.length - verified.length;
        if (rejected > 0) console.log(`[Scraper] Yelp: ${rejected} leads rejected (no contact info)`);
      } else {
        sourceErrors.yelp = (yelpRes.reason as Error).message;
        console.warn('[Scraper] Yelp fallback failed:', sourceErrors.yelp);
      }

      if (hereRes.status === 'fulfilled') {
        const verified = hereRes.value.filter(r => hasContactInfo(r));
        results.push(...enrichWithContactFlag(verified));
        sourceCounts.here = verified.length;
        const rejected = hereRes.value.length - verified.length;
        if (rejected > 0) console.log(`[Scraper] HERE: ${rejected} leads rejected (no contact info)`);
      } else {
        sourceErrors.here = (hereRes.reason as Error).message;
        console.warn('[Scraper] HERE fallback failed:', sourceErrors.here);
      }
    }

    // Step 3: Browser-based SERP supplement (Browserbase or BROWSER_WS_ENDPOINT)
    const stillNeed = results.length < LEADS_PER_SEARCH;
    if (stillNeed && hasRemoteBrowserConfigured()) {
      try {
        const want = LEADS_PER_SEARCH - results.length + 5;
        const browserRows = await fetchSerpLeadsViaBrowser(niche, location, want);
        const verified = browserRows.filter((r) => hasContactInfo(r));
        results.push(...enrichWithContactFlag(verified));
        sourceCounts.browser = verified.length;
        const rejected = browserRows.length - verified.length;
        if (rejected > 0) {
          console.log(`[Scraper] Browser SERP: ${rejected} rows rejected (no contact info)`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        sourceErrors.browser = msg;
        console.warn('[Scraper] Browser SERP supplement failed:', msg);
      }
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: false, results: [], sourceErrors,
        error: 'No verified leads found (all results lacked phone and email). Try a different city or industry.',
      });
    }

    // Deduplicate by normalised name
    const unique = Array.from(
      new Map(results.map(r => [(r.business_name || '').toLowerCase().trim(), r])).values()
    );

    // Apply sort
    const sorted = sortResults(unique, sortBy);

    // Slice to LEADS_PER_SEARCH
    const final = sorted.slice(0, LEADS_PER_SEARCH);

    return NextResponse.json({
      success: true,
      results: final,
      sourceErrors,
      sources: sourceCounts,
      fallbackUsed: needMore,
      quota: tenantId ? {
        limit:     DAILY_LEAD_LIMIT,
        used:      quotaInfo.used,
        remaining: quotaInfo.remaining,
      } : undefined,
      rejectedCount: unique.length - final.length,
    });

  } catch (error: any) {
    if (error instanceof RouteAuthError) {
      return routeErrorResponse(error);
    }

    console.error('[Scraper] Fatal:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
