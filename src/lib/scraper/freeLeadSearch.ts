import {
  fetchSerpLeadsViaBrowser,
  hasRemoteBrowserConfigured,
} from '@/lib/scraper/browserSerpLeads';
import { freePlacesService } from '@/services/freePlacesService';
import { buildOverpassClauses, resolveOsmNiche } from '@/lib/scraper/osmNicheTags';
import {
  fetchWikidataOrgs,
  geocodeFree,
  haversineKm,
  type GeoPoint,
} from '@/lib/scraper/freeGeoSources';

export interface LeadResult {
  business_name: string;
  website: string;
  snippet: string;
  source_id: string;
  source_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  rating?: number;
  category?: string;
  source: 'here' | 'osm' | 'browser' | 'google' | 'firecrawl' | 'wikidata';
  lat?: number;
  lng?: number;
  hasContact: boolean;
  reach_km?: number;
}

export type LeadStep = 'init' | 'fallbacks' | 'browser' | 'finalize';

const LEADS_PER_SEARCH = 25;
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

function hasContactInfo(r: Partial<LeadResult>): boolean {
  const phone = (r.phone || '').trim();
  const email = (r.email || '').trim();
  const website = (r.website || '').trim();
  const hasWebsite = website.length > 0 && /^https?:\/\//i.test(website);
  return phone.length > 0 || email.length > 0 || hasWebsite;
}

function enrichWithContactFlag(
  leads: Array<Omit<LeadResult, 'hasContact'> & Partial<Pick<LeadResult, 'hasContact'>>>
): LeadResult[] {
  return leads.map((l) => ({ ...l, hasContact: hasContactInfo(l) }));
}

function makeTraceableSourceId(source: string, seed: string): string {
  const normalized = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${source}:${normalized || 'unknown'}`;
}

function attachReach(leads: LeadResult[], center: GeoPoint | null, radiusKm: number): LeadResult[] {
  if (!center) return leads;
  return leads
    .map((lead) => {
      if (lead.lat == null || lead.lng == null) return { ...lead, reach_km: undefined };
      const km = haversineKm(center.lat, center.lng, lead.lat, lead.lng);
      return { ...lead, reach_km: Math.round(km * 100) / 100 };
    })
    .filter((lead) => lead.reach_km == null || lead.reach_km <= Math.max(radiusKm * 1.35, radiusKm + 5));
}

export function dedupeAndSort(results: LeadResult[], sortBy: string): LeadResult[] {
  const unique = Array.from(
    new Map(
      results.map((r) => [
        `${(r.source_id || '').trim()}::${(r.business_name || '').toLowerCase().trim()}::${(r.phone || '').trim()}::${(r.website || '').trim()}`,
        r,
      ])
    ).values()
  );

  if (sortBy === 'rating_desc') return unique.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (sortBy === 'rating_asc') return unique.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
  if (sortBy === 'reach_asc') {
    return unique.sort((a, b) => {
      const ar = a.reach_km ?? 9999;
      const br = b.reach_km ?? 9999;
      if (ar !== br) return ar - br;
      return Number(b.hasContact) - Number(a.hasContact);
    });
  }

  // Default: contact quality, then closer reach, then rating
  return unique.sort((a, b) => {
    const contactDelta = Number(b.hasContact) - Number(a.hasContact);
    if (contactDelta !== 0) return contactDelta;
    const ar = a.reach_km ?? 9999;
    const br = b.reach_km ?? 9999;
    if (ar !== br) return ar - br;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });
}

async function fetchHERE(
  niche: string,
  location: string,
  limit = 50,
  radiusKm = 25
): Promise<LeadResult[]> {
  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) throw new Error('HERE API key not configured');
  const geoRes = await fetch(
    `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(location || 'New York')}&apiKey=${apiKey}`,
    { signal: AbortSignal.timeout(6000) }
  );
  if (!geoRes.ok) throw new Error(`HERE Geocode error: ${geoRes.status}`);
  const geoData = await geoRes.json();
  const pos = geoData.items?.[0]?.position;
  if (!pos) throw new Error('HERE geocode failed');

  const radiusM = Math.min(Math.max(radiusKm * 1000, 1000), 100000);
  const searchRes = await fetch(
    `https://discover.search.hereapi.com/v1/discover?q=${encodeURIComponent(niche)}&at=${pos.lat},${pos.lng}&in=circle:${pos.lat},${pos.lng};r=${radiusM}&limit=${Math.min(limit, 100)}&apiKey=${apiKey}`,
    { signal: AbortSignal.timeout(9000) }
  );
  if (!searchRes.ok) throw new Error(`HERE Discover error: ${searchRes.status}`);
  const searchData = await searchRes.json();
  return (searchData.items || [])
    .filter((item: { title?: string }) => item.title)
    .map(
      (item: {
        title: string;
        id?: string;
        contacts?: Array<{
          www?: Array<{ value?: string }>;
          phone?: Array<{ value?: string }>;
          email?: Array<{ value?: string }>;
        }>;
        categories?: Array<{ name?: string }>;
        address?: { label?: string };
        position?: { lat?: number; lng?: number };
      }): LeadResult => ({
        business_name: item.title,
        website: item.contacts?.[0]?.www?.[0]?.value || '',
        snippet: item.categories?.[0]?.name || 'Business',
        source_id: makeTraceableSourceId(
          'here',
          item.id || item.title || `${item.position?.lat},${item.position?.lng}`
        ),
        source_url: item.contacts?.[0]?.www?.[0]?.value || '',
        phone: item.contacts?.[0]?.phone?.[0]?.value || '',
        email: item.contacts?.[0]?.email?.[0]?.value || '',
        address: item.address?.label || '',
        rating: undefined,
        category: item.categories?.[0]?.name || '',
        source: 'here',
        lat: item.position?.lat,
        lng: item.position?.lng,
        hasContact: false,
      })
    );
}

async function fetchFreePlaces(
  niche: string,
  location: string,
  limit = 20,
  radiusKm = 40
): Promise<LeadResult[]> {
  const res = await freePlacesService.searchPlacesForLeads(niche, location || 'United States', undefined, {
    radiusKm: Math.min(Math.max(radiusKm, 1), 100),
    maxResults: Math.min(limit, 50),
  });

  if (res.error && res.places.length === 0) throw new Error(res.error);

  return res.places.map(
    (p): LeadResult => ({
      business_name: p.businessName,
      website: p.website || '',
      snippet: p.industry || 'Business',
      source_id: p.placeId || makeTraceableSourceId('places', `${p.businessName}:${p.formattedAddress}`),
      source_url: p.website || '',
      phone: p.phone || '',
      email: '',
      address: p.formattedAddress || '',
      rating: p.rating,
      category: p.industry || '',
      source: p.source === 'Google Maps Scrape' ? 'browser' : 'osm',
      lat: p.lat,
      lng: p.lng,
      hasContact: false,
    })
  );
}

async function postOverpassQuery(queryBody: string): Promise<Response> {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: queryBody,
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'AlphaClone-LeadFinder/3.0 (support@alphaclonesystems.com)',
        },
        signal: AbortSignal.timeout(14000),
      });
      if (res.status === 429) throw new OverpassRequestError('Overpass 429', 429);
      if (!res.ok) {
        lastError = new OverpassRequestError(`Overpass ${res.status}`, res.status);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError instanceof OverpassRequestError && lastError.status === 429) throw lastError;
    }
  }
  throw lastError || new OverpassRequestError('Overpass request failed');
}

async function fetchOpenStreetMap(
  niche: string,
  location: string,
  targetMin = LEADS_PER_SEARCH,
  radiusKm = 25
): Promise<{ leads: LeadResult[]; center: GeoPoint | null }> {
  const isGlobal = !location || /global|world|anywhere/i.test(location);
  const geoQuery = isGlobal ? 'London, UK' : location;
  const center = await geocodeFree(geoQuery);
  if (!center) {
    throw new Error(`Location geocoding failed for "${location}". Try a more specific city.`);
  }

  const { tags, nameTerms } = resolveOsmNiche(niche);
  const isBroad = isGlobal || /state|province|country|usa|uk|canada|europe/i.test(location);
  const baseDelta = Math.min(Math.max(radiusKm / 111, 0.01), 1.2);
  const deltas = isBroad
    ? [Math.max(baseDelta, 0.8), Math.max(baseDelta * 2, 2.0), Math.max(baseDelta * 4, 4.5)]
    : [
        Math.max(baseDelta * 0.5, 0.02),
        Math.max(baseDelta, 0.08),
        Math.max(baseDelta * 2, 0.2),
        Math.max(baseDelta * 3.5, 0.45),
      ];

  let verifiedElements: Array<{
    id?: number | string;
    type?: string;
    lat?: number;
    lon?: number;
    center?: { lat?: number; lon?: number };
    tags?: Record<string, string>;
  }> = [];
  const startedAt = Date.now();

  for (const delta of deltas) {
    if (Date.now() - startedAt > 16000) break;
    const bbox = {
      south: center.lat - delta,
      north: center.lat + delta,
      west: center.lng - delta,
      east: center.lng + delta,
    };
    const fetchLimit = isBroad ? 220 : Math.max(targetMin * 5, 100);
    const clauses = buildOverpassClauses(tags, nameTerms, bbox);
    if (!clauses.trim()) continue;

    const q = `
[out:json][timeout:18];
(
  ${clauses}
);
out center ${fetchLimit};`.trim();

    try {
      const res = await postOverpassQuery(q);
      const data = await res.json();
      const all = (data.elements || []).filter(
        (el: { tags?: { name?: string } }) => el.tags?.name
      );
      verifiedElements = all;
      if (verifiedElements.length >= targetMin) break;
    } catch (err) {
      if (err instanceof OverpassRequestError && err.status === 429) break;
    }
  }

  const leads = verifiedElements.map((el): LeadResult => {
    const website = el.tags?.website || el.tags?.url || el.tags?.['contact:website'] || '';
    const phone =
      el.tags?.phone || el.tags?.['contact:phone'] || el.tags?.['phone:mobile'] || '';
    const email = el.tags?.email || el.tags?.['contact:email'] || '';
    const address = [
      el.tags?.['addr:housenumber'],
      el.tags?.['addr:street'],
      el.tags?.['addr:city'],
      el.tags?.['addr:postcode'],
      el.tags?.['addr:country'],
    ]
      .filter(Boolean)
      .join(' ');

    return {
      business_name: el.tags?.name || 'Unknown',
      website,
      snippet:
        el.tags?.amenity ||
        el.tags?.shop ||
        el.tags?.office ||
        el.tags?.craft ||
        el.tags?.healthcare ||
        'Local business',
      source_id: makeTraceableSourceId('osm', `${el.type || 'node'}:${el.id}`),
      source_url: website,
      phone,
      email,
      address,
      rating: undefined,
      category: el.tags?.amenity || el.tags?.shop || el.tags?.office || el.tags?.craft || '',
      source: 'osm',
      lat: el.lat ?? el.center?.lat,
      lng: el.lon ?? el.center?.lon,
      hasContact: hasContactInfo({ phone, email, website }),
    };
  });

  return { leads: attachReach(leads, center, radiusKm), center };
}

async function fetchWikidataLeads(
  niche: string,
  location: string,
  limit = 12
): Promise<LeadResult[]> {
  const orgs = await fetchWikidataOrgs(niche, location, limit);
  return orgs.map((org) => {
    const address = [org.city, org.country].filter(Boolean).join(', ');
    const website = org.website || '';
    return {
      business_name: org.name,
      website,
      snippet: 'Wikidata organization',
      source_id: makeTraceableSourceId('wikidata', org.wikidataId || org.name),
      source_url: website || `https://www.wikidata.org/wiki/${org.wikidataId}`,
      phone: '',
      email: '',
      address,
      category: niche,
      source: 'wikidata' as const,
      lat: org.lat,
      lng: org.lng,
      hasContact: hasContactInfo({ website }),
    };
  });
}

/** Optional free DuckDuckGo HTML scrape when Firecrawl is unavailable. */
async function fetchDuckDuckGoLeads(
  niche: string,
  location: string,
  limit = 10
): Promise<LeadResult[]> {
  const query = `${niche} ${location} contact phone website`;
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'AlphaClone-LeadFinder/3.0 (support@alphaclonesystems.com)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const { load } = await import('cheerio');
    const $ = load(html);
    const leads: LeadResult[] = [];

    $('.result, .web-result').each((_, el) => {
      if (leads.length >= limit) return;
      const title = $(el).find('.result__a, a.result__a').first().text().trim();
      const href = $(el).find('.result__a, a.result__a').first().attr('href') || '';
      const snippet = $(el).find('.result__snippet').text().trim();
      if (!title || title.length < 3) return;
      // Skip obvious non-business SERP noise
      if (/wikipedia|facebook\.com\/login|linkedin\.com\/pub/i.test(href + title)) return;

      let website = '';
      try {
        const u = new URL(href.startsWith('http') ? href : `https://${href}`);
        // DuckDuckGo redirect links
        const uddg = u.searchParams.get('uddg');
        website = uddg || (u.hostname.includes('duckduckgo') ? '' : u.origin);
      } catch {
        website = '';
      }

      leads.push({
        business_name: title.replace(/\s*[-|].*$/, '').slice(0, 120),
        website,
        snippet: snippet.slice(0, 200) || 'Web result',
        source_id: makeTraceableSourceId('browser', `${title}:${website || href}`),
        source_url: website || href,
        phone: '',
        email: '',
        address: location,
        category: niche,
        source: 'browser',
        hasContact: Boolean(website),
      });
    });

    return leads;
  } catch (err) {
    console.warn('[freeLeadSearch] DuckDuckGo scrape failed:', err);
    return [];
  }
}

export async function runLeadStep(input: {
  step: LeadStep;
  niche: string;
  location: string;
  radiusKm: number;
  sortBy: string;
  usePlaywright: boolean;
  partialResults: LeadResult[];
  sourceStats: Record<string, number>;
  sourceErrors: Record<string, string>;
  searchCenter?: GeoPoint | null;
}): Promise<{
  nextStep: LeadStep | 'completed';
  progress: number;
  partialResults: LeadResult[];
  finalResults: LeadResult[];
  sourceStats: Record<string, number>;
  sourceErrors: Record<string, string>;
  fallbackUsed: boolean;
  searchCenter: GeoPoint | null;
  stepLabel: string;
}> {
  const sourceStats = {
    osm: 0,
    google: 0,
    here: 0,
    browser: 0,
    firecrawl: 0,
    wikidata: 0,
    ...input.sourceStats,
  };
  const sourceErrors = { ...input.sourceErrors };
  let partial = [...input.partialResults];
  let searchCenter = input.searchCenter ?? null;

  if (input.step === 'init') {
    try {
      const [osmRes, wikiRes, firecrawlRes, browserRes] = await Promise.allSettled([
        fetchOpenStreetMap(input.niche, input.location, LEADS_PER_SEARCH, input.radiusKm),
        fetchWikidataLeads(input.niche, input.location, 10),
        import('@/services/firecrawlService')
          .then((m) =>
            m.firecrawlService.searchLeads(
              `${input.niche} businesses in ${input.location} contact info`,
              LEADS_PER_SEARCH
            )
          )
          .catch(() => []),
        input.usePlaywright && hasRemoteBrowserConfigured()
          ? fetchSerpLeadsViaBrowser(input.niche, input.location, LEADS_PER_SEARCH)
          : Promise.resolve([]),
      ]);

      if (osmRes.status === 'fulfilled') {
        searchCenter = osmRes.value.center;
        const withReach = attachReach(osmRes.value.leads, searchCenter, input.radiusKm);
        partial.push(...enrichWithContactFlag(withReach));
        sourceStats.osm = osmRes.value.leads.length;
      } else {
        sourceErrors.osm =
          osmRes.reason instanceof Error ? osmRes.reason.message : 'OpenStreetMap unavailable';
        searchCenter = searchCenter || (await geocodeFree(input.location));
      }

      if (wikiRes.status === 'fulfilled') {
        const withReach = attachReach(wikiRes.value, searchCenter, input.radiusKm * 4);
        partial.push(...enrichWithContactFlag(withReach));
        sourceStats.wikidata = wikiRes.value.length;
      }

      if (firecrawlRes.status === 'fulfilled' && Array.isArray(firecrawlRes.value) && firecrawlRes.value.length) {
        partial.push(...enrichWithContactFlag(firecrawlRes.value as LeadResult[]));
        sourceStats.firecrawl = firecrawlRes.value.length;
      } else if (sourceStats.firecrawl === 0) {
        // Free DuckDuckGo fallback when Firecrawl is missing/empty
        const ddg = await fetchDuckDuckGoLeads(input.niche, input.location, 8);
        if (ddg.length) {
          partial.push(...enrichWithContactFlag(ddg));
          sourceStats.browser = (sourceStats.browser || 0) + ddg.length;
        }
      }

      if (browserRes.status === 'fulfilled') {
        const rows = browserRes.value as LeadResult[];
        partial.push(...enrichWithContactFlag(rows));
        sourceStats.browser = (sourceStats.browser || 0) + rows.length;
      }
    } catch {
      console.warn('[Scraper:Job] Primary free sources failed');
    }

    partial = attachReach(dedupeAndSort(partial, input.sortBy || 'reach_asc'), searchCenter, input.radiusKm * 1.5);
    const finalMaybe = partial.slice(0, LEADS_PER_SEARCH);
    if (finalMaybe.length >= LEADS_PER_SEARCH) {
      return {
        nextStep: 'completed',
        progress: 100,
        partialResults: finalMaybe,
        finalResults: finalMaybe,
        sourceStats,
        sourceErrors,
        fallbackUsed: false,
        searchCenter,
        stepLabel: 'OpenStreetMap + Wikidata discovery complete',
      };
    }
    return {
      nextStep: 'fallbacks',
      progress: 55,
      partialResults: partial,
      finalResults: [],
      sourceStats,
      sourceErrors,
      fallbackUsed: true,
      searchCenter,
      stepLabel: 'Primary free sources scanned — widening radius',
    };
  }

  if (input.step === 'fallbacks') {
    const need = Math.max(0, LEADS_PER_SEARCH - partial.length) + 8;
    const tasks: Array<Promise<LeadResult[]>> = [
      fetchFreePlaces(input.niche, input.location, need, input.radiusKm),
    ];

    // HERE is optional free-tier key — never required
    if (process.env.HERE_API_KEY && !process.env.HERE_API_KEY.startsWith('your_')) {
      tasks.push(fetchHERE(input.niche, input.location, need, input.radiusKm));
    }

    const settled = await Promise.allSettled(tasks);

    if (settled[0]?.status === 'fulfilled') {
      const withReach = attachReach(settled[0].value, searchCenter, input.radiusKm * 1.5);
      partial.push(...enrichWithContactFlag(withReach));
      sourceStats.google = settled[0].value.length;
    } else if (settled[0]?.status === 'rejected') {
      sourceErrors.google = 'Free places (OSM/Foursquare) fallback unavailable';
    }

    if (settled[1]?.status === 'fulfilled') {
      const withReach = attachReach(settled[1].value, searchCenter, input.radiusKm);
      partial.push(...enrichWithContactFlag(withReach));
      sourceStats.here = settled[1].value.length;
    }

    return {
      nextStep: 'finalize',
      progress: 88,
      partialResults: dedupeAndSort(
        attachReach(partial, searchCenter, input.radiusKm * 1.5),
        input.sortBy || 'reach_asc'
      ),
      finalResults: [],
      sourceStats,
      sourceErrors,
      fallbackUsed: true,
      searchCenter,
      stepLabel: 'Fallback directories merged',
    };
  }

  if (input.step === 'browser') {
    if (input.usePlaywright && hasRemoteBrowserConfigured() && partial.length < LEADS_PER_SEARCH) {
      try {
        const want = LEADS_PER_SEARCH - partial.length + 5;
        const rows = await fetchSerpLeadsViaBrowser(input.niche, input.location, want);
        const verified = rows.filter((r) => hasContactInfo(r));
        partial.push(...enrichWithContactFlag(verified as LeadResult[]));
        sourceStats.browser = (sourceStats.browser || 0) + verified.length;
      } catch {
        sourceErrors.browser = 'Browser source unavailable';
      }
    }
    return {
      nextStep: 'finalize',
      progress: 92,
      partialResults: dedupeAndSort(partial, input.sortBy || 'reach_asc'),
      finalResults: [],
      sourceStats,
      sourceErrors,
      fallbackUsed: true,
      searchCenter,
      stepLabel: 'Browser SERP enrichment',
    };
  }

  const final = dedupeAndSort(
    attachReach(partial, searchCenter, input.radiusKm * 1.5),
    input.sortBy || 'reach_asc'
  ).slice(0, LEADS_PER_SEARCH);

  return {
    nextStep: 'completed',
    progress: 100,
    partialResults: final,
    finalResults: final,
    sourceStats,
    sourceErrors,
    fallbackUsed: true,
    searchCenter,
    stepLabel: 'Reach-ranked leads ready',
  };
}
