import {
  fetchSerpLeadsViaBrowser,
  hasRemoteBrowserConfigured,
} from '@/lib/scraper/browserSerpLeads';
import { googlePlacesService } from '@/services/googlePlacesService';

export interface LeadResult {
  business_name: string;
  website: string;
  snippet: string;
  phone?: string;
  email?: string;
  address?: string;
  rating?: number;
  category?: string;
  source: 'here' | 'osm' | 'browser' | 'google' | 'firecrawl';
  lat?: number;
  lng?: number;
  hasContact: boolean;
}

export type LeadStep = 'init' | 'fallbacks' | 'browser' | 'finalize';

const LEADS_PER_SEARCH = 20;
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

function enrichWithContactFlag(leads: Array<Omit<LeadResult, 'hasContact'> & Partial<Pick<LeadResult, 'hasContact'>>>): LeadResult[] {
  return leads.map((l) => ({ ...l, hasContact: hasContactInfo(l) }));
}

export function dedupeAndSort(results: LeadResult[], sortBy: string): LeadResult[] {
  const unique = Array.from(
    new Map(results.map((r) => [`${(r.business_name || '').toLowerCase().trim()}::${(r.phone || '').trim()}::${(r.website || '').trim()}`, r])).values()
  );
  if (sortBy === 'rating_desc') return unique.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (sortBy === 'rating_asc') return unique.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
  return unique;
}

async function fetchHERE(niche: string, location: string, limit = 20): Promise<LeadResult[]> {
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
  const searchRes = await fetch(
    `https://discover.search.hereapi.com/v1/discover?q=${encodeURIComponent(niche)}&at=${pos.lat},${pos.lng}&limit=${Math.min(limit, 100)}&apiKey=${apiKey}`,
    { signal: AbortSignal.timeout(9000) }
  );
  if (!searchRes.ok) throw new Error(`HERE Discover error: ${searchRes.status}`);
  const searchData = await searchRes.json();
  return (searchData.items || [])
    .filter((item: any) => item.title)
    .map((item: any): LeadResult => ({
      business_name: item.title,
      website: item.contacts?.[0]?.www?.[0]?.value || '',
      snippet: item.categories?.[0]?.name || 'Business',
      phone: item.contacts?.[0]?.phone?.[0]?.value || '',
      email: item.contacts?.[0]?.email?.[0]?.value || '',
      address: item.address?.label || '',
      rating: undefined,
      category: item.categories?.[0]?.name || '',
      source: 'here',
      lat: item.position?.lat,
      lng: item.position?.lng,
      hasContact: false,
    }));
}

function resolveGooglePlacesApiKey(): string | null {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    null
  );
}

async function fetchGooglePlaces(niche: string, location: string, limit = 20, radiusKm = 40): Promise<LeadResult[]> {
  const apiKey = resolveGooglePlacesApiKey();
  if (!apiKey) throw new Error('Google Places API key not configured');

  const res = await googlePlacesService.searchPlacesForLeads(niche, location || 'United States', apiKey, {
    radiusKm: Math.min(Math.max(radiusKm, 1), 100),
    maxResults: Math.min(limit, 20),
  });

  if (res.error) throw new Error(res.error);

  return res.places.map((p): LeadResult => ({
    business_name: p.businessName,
    website: p.website || '',
    snippet: p.industry || 'Google Place',
    phone: p.phone || '',
    email: '',
    address: p.formattedAddress || '',
    rating: p.rating,
    category: p.industry || '',
    source: 'google',
    lat: p.lat,
    lng: p.lng,
    hasContact: false,
  }));
}

async function postOverpassQuery(queryBody: string): Promise<Response> {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: queryBody,
        headers: { 'Content-Type': 'text/plain' },
        signal: AbortSignal.timeout(6000),
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
): Promise<LeadResult[]> {
  const isGlobal = !location || /global|world|anywhere/i.test(location);
  const geoQuery = isGlobal ? 'London, UK' : location;
  const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoQuery)}&format=json&limit=1`;
  let nomData: any[] = [];
  try {
    const nomRes = await fetch(nomUrl, { 
      headers: { 'User-Agent': 'AlphaClone-LeadFinder/1.0 (support@alphaclonesystems.com)' },
      signal: AbortSignal.timeout(7000) 
    });
    if (nomRes.ok) nomData = await nomRes.json();
  } catch (e) {
    console.warn('[OSM:Job] Nominatim geocode failed, trying fallbacks...');
  }

  let centerLat: number;
  let centerLon: number;

  if (nomData?.[0]) {
    centerLat = parseFloat(nomData[0].lat);
    centerLon = parseFloat(nomData[0].lon);
  } else {
    // Fallback: HERE Geocoding
    try {
      const hereKey = process.env.HERE_API_KEY;
      if (hereKey && !hereKey.startsWith('your_')) {
        const hRes = await fetch(
          `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(geoQuery)}&apiKey=${hereKey}`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (hRes.ok) {
          const hData = await hRes.json();
          const pos = hData.items?.[0]?.position;
          if (pos) {
            centerLat = pos.lat;
            centerLon = pos.lng;
          } else throw new Error('no results');
        } else throw new Error('here failed');
      } else throw new Error('no key');
    } catch (err) {
      throw new Error(`Location geocoding failed for "${location}". Please try a more specific city.`);
    }
  }
  const isBroad = isGlobal || /state|province|country|usa|uk|canada|europe/i.test(location);
  const baseDelta = Math.min(Math.max(radiusKm / 111, 0.01), 1.2);
  const deltas = isBroad
    ? [Math.max(baseDelta, 1.0), Math.max(baseDelta * 2, 2.5), Math.max(baseDelta * 5, 6.0)]
    : (location.includes(',')
      ? [Math.max(baseDelta * 0.4, 0.01), Math.max(baseDelta, 0.05), Math.max(baseDelta * 2, 0.15), Math.max(baseDelta * 4, 0.5)]
      : [Math.max(baseDelta, 0.15), Math.max(baseDelta * 2, 0.3), Math.max(baseDelta * 4, 0.6), Math.max(baseDelta * 8, 1.2)]);

  let verifiedElements: any[] = [];
  const startedAt = Date.now();
  for (const delta of deltas) {
    if (Date.now() - startedAt > 14000) break;
    const south = centerLat - delta;
    const north = centerLat + delta;
    const west = centerLon - delta;
    const east = centerLon + delta;
    const fetchLimit = isBroad ? 200 : Math.max(targetMin * 4, 80);
    const nicheEscaped = niche.replace(/["\\]/g, '');
    const q = `
[out:json][timeout:12];
(
  node["name"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["amenity"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["shop"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["office"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["name"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["amenity"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["shop"~"${nicheEscaped}",i](${south},${west},${north},${east});
  relation["name"~"${nicheEscaped}",i](${south},${west},${north},${east});
)
;
out center ${fetchLimit};`.trim();
    try {
      const res = await postOverpassQuery(q);
      const data = await res.json();
      const all = (data.elements || []).filter((el: any) => el.tags?.name);
      verifiedElements = all.filter((el: any) => {
        const p = el.tags.phone || el.tags['contact:phone'] || el.tags['phone:mobile'] || '';
        const e = el.tags.email || el.tags['contact:email'] || '';
        const w = el.tags.website || el.tags.url || el.tags['contact:website'] || '';
        const hasWebsite = String(w).trim().length > 0;
        return p.trim().length > 0 || e.trim().length > 0 || hasWebsite;
      });
      if (verifiedElements.length >= targetMin) break;
    } catch (err) {
      if (err instanceof OverpassRequestError && err.status === 429) break;
    }
  }

  return verifiedElements.map((el: any): LeadResult => ({
    business_name: el.tags.name,
    website: el.tags.website || el.tags.url || el.tags['contact:website'] || '',
    snippet: el.tags.amenity || el.tags.shop || el.tags.office || 'Local business',
    phone: el.tags.phone || el.tags['contact:phone'] || el.tags['phone:mobile'] || '',
    email: el.tags.email || el.tags['contact:email'] || '',
    address: [el.tags['addr:housenumber'], el.tags['addr:street'], el.tags['addr:city'], el.tags['addr:country']].filter(Boolean).join(' '),
    rating: undefined,
    category: el.tags.amenity || el.tags.shop || el.tags.office || '',
    source: 'osm',
    lat: el.lat ?? el.center?.lat,
    lng: el.lon ?? el.center?.lon,
    hasContact: true,
  }));
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
}): Promise<{
  nextStep: LeadStep | 'completed';
  progress: number;
  partialResults: LeadResult[];
  finalResults: LeadResult[];
  sourceStats: Record<string, number>;
  sourceErrors: Record<string, string>;
  fallbackUsed: boolean;
}> {
  const sourceStats = { osm: 0, google: 0, here: 0, browser: 0, firecrawl: 0, ...input.sourceStats };
  const sourceErrors = { ...input.sourceErrors };
  const partial = [...input.partialResults];

  if (input.step === 'init') {
    try {
      const [osmRes, hereRes] = await Promise.allSettled([
        fetchOpenStreetMap(input.niche, input.location, LEADS_PER_SEARCH, input.radiusKm),
        fetchHERE(input.niche, input.location, LEADS_PER_SEARCH),
      ]);

      if (osmRes.status === 'fulfilled') {
        const verified = osmRes.value.filter((r) => hasContactInfo(r));
        partial.push(...enrichWithContactFlag(verified));
        sourceStats.osm = verified.length;
      } else {
        sourceErrors.osm = 'OSM temporarily unavailable';
      }

      if (hereRes.status === 'fulfilled') {
        const verified = hereRes.value.filter((r) => hasContactInfo(r));
        partial.push(...enrichWithContactFlag(verified));
        sourceStats.here = verified.length;
      } else {
        sourceErrors.here = 'HERE temporarily unavailable';
      }
    } catch {
      console.warn('[Scraper:Job] Primary sources failed');
    }
    const finalMaybe = dedupeAndSort(partial, input.sortBy).slice(0, LEADS_PER_SEARCH);
    if (finalMaybe.length >= LEADS_PER_SEARCH) {
      return {
        nextStep: 'completed',
        progress: 100,
        partialResults: finalMaybe,
        finalResults: finalMaybe,
        sourceStats,
        sourceErrors,
        fallbackUsed: false,
      };
    }
    return {
      nextStep: 'fallbacks',
      progress: 45,
      partialResults: dedupeAndSort(partial, input.sortBy),
      finalResults: [],
      sourceStats,
      sourceErrors,
      fallbackUsed: true,
    };
  }

  if (input.step === 'fallbacks') {
    const need = Math.max(0, LEADS_PER_SEARCH - partial.length) + 5;
    
    const [googleRes, firecrawlRes] = await Promise.allSettled([
      fetchGooglePlaces(input.niche, input.location, need, input.radiusKm),
      import('@/services/firecrawlService').then(m => m.firecrawlService.searchLeads(`${input.niche} in ${input.location}`, need))
    ]);

    if (googleRes.status === 'fulfilled') {
      const verified = googleRes.value.filter((r) => hasContactInfo(r));
      partial.push(...enrichWithContactFlag(verified));
      sourceStats.google = verified.length;
    } else {
      const msg = googleRes.reason instanceof Error ? googleRes.reason.message : String(googleRes.reason);
      if (msg.toLowerCase().includes('billing') || msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('authorized')) {
        sourceErrors.google = 'Google Maps Billing Error: Please verify your Google Cloud console billing.';
      } else {
        sourceErrors.google = 'Google Places unavailable';
      }
    }

    if (firecrawlRes.status === 'fulfilled') {
      const verified = firecrawlRes.value.filter((r) => hasContactInfo(r));
      partial.push(...enrichWithContactFlag(verified));
      sourceStats.firecrawl = verified.length;
    } else {
      sourceErrors.firecrawl = 'Firecrawl AI unavailable';
    }
    return {
      nextStep: 'browser',
      progress: 75,
      partialResults: dedupeAndSort(partial, input.sortBy),
      finalResults: [],
      sourceStats,
      sourceErrors,
      fallbackUsed: true,
    };
  }

  if (input.step === 'browser') {
    if (input.usePlaywright && hasRemoteBrowserConfigured() && partial.length < LEADS_PER_SEARCH) {
      try {
        const want = LEADS_PER_SEARCH - partial.length + 5;
        const rows = await fetchSerpLeadsViaBrowser(input.niche, input.location, want);
        const verified = rows.filter((r) => hasContactInfo(r));
        partial.push(...enrichWithContactFlag(verified as LeadResult[]));
        sourceStats.browser = verified.length;
      } catch {
        sourceErrors.browser = 'Browser source unavailable';
      }
    }
    return {
      nextStep: 'finalize',
      progress: 90,
      partialResults: dedupeAndSort(partial, input.sortBy),
      finalResults: [],
      sourceStats,
      sourceErrors,
      fallbackUsed: true,
    };
  }

  const final = dedupeAndSort(partial, input.sortBy).slice(0, LEADS_PER_SEARCH);
  return {
    nextStep: 'completed',
    progress: 100,
    partialResults: final,
    finalResults: final,
    sourceStats,
    sourceErrors,
    fallbackUsed: true,
  };
}
