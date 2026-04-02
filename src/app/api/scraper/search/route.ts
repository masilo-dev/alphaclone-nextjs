import { NextResponse } from 'next/server';

// ─── Shared Types ─────────────────────────────────────────────────────────────
export interface LeadResult {
  business_name: string;
  website:       string;
  snippet:       string;
  phone?:        string;
  email?:        string;      // single best email when available
  address?:      string;
  rating?:       number;
  category?:     string;
  source:        'yelp' | 'here' | 'osm';
  lat?:          number;
  lng?:          number;
}

// ─── Strategy 1 (Fallback): Yelp Fusion ──────────────────────────────────────
async function fetchYelp(niche: string, location: string, limit = 20, sortBy: string): Promise<LeadResult[]> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) throw new Error('Yelp API key not configured');

  const yelpSort = sortBy === 'rating_asc' ? 'rating' : 'rating'; // Yelp only supports 'rating' desc
  const params = new URLSearchParams({
    term: niche,
    location: location || 'United States',
    limit: String(Math.min(limit, 50)),
    sort_by: yelpSort,
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
    address:       [b.location?.address1, b.location?.city, b.location?.state, b.location?.country].filter(Boolean).join(', '),
    rating:        b.rating,
    category:      b.categories?.[0]?.title || '',
    source:        'yelp',
    lat:           b.coordinates?.latitude,
    lng:           b.coordinates?.longitude,
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
      address:       item.address?.label || '',
      rating:        undefined,
      category:      item.categories?.[0]?.name || '',
      source:        'here',
      lat:           item.position?.lat,
      lng:           item.position?.lng,
    }));
}

// ─── Strategy 3 (PRIMARY): OpenStreetMap / Overpass ──────────────────────────
// OSM is always free, always runs. Minimum 20 results. If city not found,
// widens the search box. We also attempt Nominatim email lookup.
async function fetchOpenStreetMap(niche: string, location: string, targetMin = 20): Promise<LeadResult[]> {
  // Step 1: Nominatim → lat/lon for the city
  const nomRes = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location || 'United States')}&format=json&limit=1`,
    {
      headers: { 'User-Agent': 'AlphaClone-LeadFinder/1.0 (support@alphaclone.tech)' },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!nomRes.ok) throw new Error('Nominatim geocoding failed');
  const nomData = await nomRes.json();
  if (!nomData[0]) throw new Error('OSM: location not found');

  const { lat, lon } = nomData[0];

  // Try progressively larger bounding boxes to reach targetMin results
  const deltas = [0.15, 0.3, 0.6, 1.2]; // ~16 / 33 / 66 / 133 km radius
  let elements: any[] = [];

  for (const delta of deltas) {
    const south = +lat - delta;
    const west  = +lon - delta;
    const north = +lat + delta;
    const east  = +lon + delta;
    const limit = Math.max(targetMin, 60);

    const q = `
[out:json][timeout:28];
(
  node["name"~"${niche.replace(/["\\]/g, '')}",i]["phone"](${south},${west},${north},${east});
  node["name"~"${niche.replace(/["\\]/g, '')}",i]["website"](${south},${west},${north},${east});
  node["name"~"${niche.replace(/["\\]/g, '')}",i]["amenity"](${south},${west},${north},${east});
  node["name"~"${niche.replace(/["\\]/g, '')}",i]["shop"](${south},${west},${north},${east});
  way["name"~"${niche.replace(/["\\]/g, '')}",i]["phone"](${south},${west},${north},${east});
  way["name"~"${niche.replace(/["\\]/g, '')}",i]["website"](${south},${west},${north},${east});
);
out body ${limit};
    `.trim();

    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', body: q,
        headers: { 'Content-Type': 'text/plain' },
        signal: AbortSignal.timeout(28000),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const data = await res.json();
      elements = (data.elements || []).filter((el: any) => el.tags?.name);
      if (elements.length >= targetMin) break; // got enough — stop widening
    } catch (err) {
      console.warn('[OSM] Overpass attempt failed, widening bbox:', err);
    }
  }

  return elements.map((el: any): LeadResult => ({
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
  }));
}

// ─── Sort helper ─────────────────────────────────────────────────────────────
function sortResults(results: LeadResult[], sortBy: string): LeadResult[] {
  if (sortBy === 'rating_desc') {
    return [...results].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }
  if (sortBy === 'rating_asc') {
    return [...results].sort((a, b) => {
      // Put unrated last in ascending sort
      if (a.rating === undefined && b.rating === undefined) return 0;
      if (a.rating === undefined) return 1;
      if (b.rating === undefined) return -1;
      return a.rating - b.rating;
    });
  }
  return results; // 'default' — OSM first, then fallbacks
}

// ─── Main POST Handler ────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const niche    = body.niche    || body.query?.split(' in ')[0]?.trim() || '';
    const location = body.location || body.query?.split(' in ')[1]?.trim() || '';
    const sortBy   = body.sortBy   || 'default';  // 'default' | 'rating_asc' | 'rating_desc'
    const targetMin = 20;

    if (!niche) {
      return NextResponse.json({ error: 'Industry/niche is required' }, { status: 400 });
    }

    const results: LeadResult[] = [];
    const sourceErrors: Record<string, string> = {};
    const sourceCounts: Record<string, number> = { osm: 0, yelp: 0, here: 0 };

    // ── Step 1: OSM runs FIRST (primary, always free) ──────────────────────
    try {
      const osmResults = await fetchOpenStreetMap(niche, location, targetMin);
      results.push(...osmResults);
      sourceCounts.osm = osmResults.length;
      console.log(`[Scraper] OSM returned ${osmResults.length} results`);
    } catch (err: any) {
      sourceErrors.osm = err.message;
      console.warn('[Scraper] OSM failed:', err.message);
    }

    // ── Step 2: Only call Yelp + HERE if OSM < targetMin (fallbacks) ───────
    const needMore = results.length < targetMin;
    if (needMore) {
      console.log(`[Scraper] OSM only got ${results.length} results, activating fallbacks…`);
      const [yelpRes, hereRes] = await Promise.allSettled([
        fetchYelp(niche, location, targetMin - results.length + 5, sortBy),
        fetchHERE(niche, location, targetMin - results.length + 5),
      ]);

      if (yelpRes.status === 'fulfilled') {
        results.push(...yelpRes.value);
        sourceCounts.yelp = yelpRes.value.length;
      } else {
        sourceErrors.yelp = (yelpRes.reason as Error).message;
        console.warn('[Scraper] Yelp fallback failed:', sourceErrors.yelp);
      }

      if (hereRes.status === 'fulfilled') {
        results.push(...hereRes.value);
        sourceCounts.here = hereRes.value.length;
      } else {
        sourceErrors.here = (hereRes.reason as Error).message;
        console.warn('[Scraper] HERE fallback failed:', sourceErrors.here);
      }
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: false, results: [], sourceErrors,
        error: 'No results found. Try a different city or industry name.',
      });
    }

    // Deduplicate by normalised name
    const unique = Array.from(
      new Map(results.map(r => [r.business_name.toLowerCase().trim(), r])).values()
    );

    // Apply sort
    const sorted = sortResults(unique, sortBy);

    return NextResponse.json({
      success: true,
      results: sorted,          // no hard 60 cap — return all up to what OSM found
      sourceErrors,
      sources: sourceCounts,
      fallbackUsed: needMore,
    });

  } catch (error: any) {
    console.error('[Scraper] Fatal:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
