import { NextResponse } from 'next/server';

// ─── Shared Types ────────────────────────────────────────────────────────────
export interface LeadResult {
  business_name: string;
  website: string;
  snippet: string;
  phone?: string;
  address?: string;
  rating?: number;
  category?: string;
  source: 'yelp' | 'here' | 'osm';
  lat?: number;
  lng?: number;
}

// ─── Strategy 1: Yelp Fusion API ─────────────────────────────────────────────
async function fetchYelp(niche: string, location: string, limit = 50): Promise<LeadResult[]> {
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
    website: b.url || '',
    snippet: b.categories?.[0]?.title || 'Business',
    phone: b.display_phone || b.phone || '',
    address: [b.location?.address1, b.location?.city, b.location?.state, b.location?.country]
      .filter(Boolean).join(', '),
    rating: b.rating,
    category: b.categories?.[0]?.title || '',
    source: 'yelp',
    lat: b.coordinates?.latitude,
    lng: b.coordinates?.longitude,
  }));
}

// ─── Strategy 2: HERE Maps Places API ────────────────────────────────────────
async function fetchHERE(niche: string, location: string, limit = 50): Promise<LeadResult[]> {
  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) throw new Error('HERE API key not configured');

  // Step 1: Geocode the location string → lat/lng
  const geoRes = await fetch(
    `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(location || 'New York')}&apiKey=${apiKey}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!geoRes.ok) throw new Error(`HERE Geocode error: ${geoRes.status}`);
  const geoData = await geoRes.json();
  const pos = geoData.items?.[0]?.position;
  if (!pos) throw new Error('HERE: could not geocode location');

  // Step 2: Discover businesses around those coordinates
  const searchRes = await fetch(
    `https://discover.search.hereapi.com/v1/discover?q=${encodeURIComponent(niche)}&at=${pos.lat},${pos.lng}&limit=${Math.min(limit, 100)}&apiKey=${apiKey}`,
    { signal: AbortSignal.timeout(12000) }
  );
  if (!searchRes.ok) throw new Error(`HERE Discover error: ${searchRes.status}`);
  const searchData = await searchRes.json();

  return (searchData.items || []).map((item: any): LeadResult => ({
    business_name: item.title,
    website: item.contacts?.[0]?.www?.[0]?.value || '',
    snippet: item.categories?.[0]?.name || 'Business',
    phone: item.contacts?.[0]?.phone?.[0]?.value || '',
    address: item.address?.label || '',
    rating: undefined,
    category: item.categories?.[0]?.name || '',
    source: 'here',
    lat: item.position?.lat,
    lng: item.position?.lng,
  })).filter((r: LeadResult) => r.business_name);
}

// ─── Strategy 3: OpenStreetMap / Overpass API (Always Free) ──────────────────
async function fetchOpenStreetMap(niche: string, location: string): Promise<LeadResult[]> {
  // Step 1: Nominatim → get bounding box for the location
  const nomRes = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location || 'New York')}&format=json&limit=1`,
    {
      headers: { 'User-Agent': 'AlphaClone-LeadFinder/1.0 (support@alphaclone.tech)' },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!nomRes.ok) throw new Error('Nominatim geocoding failed');
  const nomData = await nomRes.json();
  if (!nomData[0]) throw new Error('OSM: location not found');

  const { lat, lon } = nomData[0];
  const delta = 0.15; // ~16km radius
  const south = +lat - delta;
  const west  = +lon - delta;
  const north = +lat + delta;
  const east  = +lon + delta;

  // Step 2: Overpass query — find named businesses with phone OR website in bbox
  const overpassQuery = `
[out:json][timeout:20];
(
  node["name"~"${niche.replace(/"/g, '')}",i]["phone"](${south},${west},${north},${east});
  node["name"~"${niche.replace(/"/g, '')}",i]["website"](${south},${west},${north},${east});
  node["name"~"${niche.replace(/"/g, '')}",i]["amenity"](${south},${west},${north},${east});
  way["name"~"${niche.replace(/"/g, '')}",i]["phone"](${south},${west},${north},${east});
  way["name"~"${niche.replace(/"/g, '')}",i]["website"](${south},${west},${north},${east});
);
out body 60;
  `.trim();

  const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: overpassQuery,
    headers: { 'Content-Type': 'text/plain' },
    signal: AbortSignal.timeout(25000),
  });
  if (!overpassRes.ok) throw new Error('Overpass API failed');
  const overpassData = await overpassRes.json();

  return (overpassData.elements || [])
    .filter((el: any) => el.tags?.name)
    .map((el: any): LeadResult => ({
      business_name: el.tags.name,
      website: el.tags.website || el.tags.url || el.tags['contact:website'] || '',
      snippet: el.tags.amenity || el.tags.shop || el.tags.office || el.tags.craft || 'Local business',
      phone: el.tags.phone || el.tags['contact:phone'] || el.tags['phone:mobile'] || '',
      address: [
        el.tags['addr:housenumber'],
        el.tags['addr:street'],
        el.tags['addr:city'],
        el.tags['addr:country'],
      ].filter(Boolean).join(' '),
      rating: undefined,
      category: el.tags.amenity || el.tags.shop || el.tags.office || '',
      source: 'osm',
      lat: el.lat ?? el.center?.lat,
      lng: el.lon ?? el.center?.lon,
    }));
}

// ─── Main POST Handler ────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Support both old `query` field and new separate `niche` + `location` fields
    const niche    = body.niche    || body.query?.split(' in ')[0]?.trim() || '';
    const location = body.location || body.query?.split(' in ')[1]?.trim() || '';

    if (!niche) {
      return NextResponse.json({ error: 'Industry/niche is required' }, { status: 400 });
    }

    // Run all three strategies in parallel — graceful degradation
    const [yelpRes, hereRes, osmRes] = await Promise.allSettled([
      fetchYelp(niche, location),
      fetchHERE(niche, location),
      fetchOpenStreetMap(niche, location),
    ]);

    const results: LeadResult[] = [];
    const sourceErrors: Record<string, string> = {};

    if (yelpRes.status === 'fulfilled') {
      results.push(...yelpRes.value);
    } else {
      sourceErrors.yelp = (yelpRes.reason as Error).message;
      console.warn('[Scraper] Yelp failed:', sourceErrors.yelp);
    }

    if (hereRes.status === 'fulfilled') {
      results.push(...hereRes.value);
    } else {
      sourceErrors.here = (hereRes.reason as Error).message;
      console.warn('[Scraper] HERE failed:', sourceErrors.here);
    }

    if (osmRes.status === 'fulfilled') {
      results.push(...osmRes.value);
    } else {
      sourceErrors.osm = (osmRes.reason as Error).message;
      console.warn('[Scraper] OSM failed:', sourceErrors.osm);
    }

    // Deduplicate by normalized business name
    const unique = Array.from(
      new Map(results.map(r => [r.business_name.toLowerCase().trim(), r])).values()
    );

    if (unique.length === 0) {
      const errorMsg = Object.entries(sourceErrors)
        .map(([src, err]) => `${src.toUpperCase()}: ${err}`)
        .join(' | ');
      return NextResponse.json({
        success: false,
        results: [],
        sourceErrors,
        error: errorMsg || 'No results found. Add YELP_API_KEY or HERE_API_KEY to .env for more results.',
      });
    }

    return NextResponse.json({
      success: true,
      results: unique.slice(0, 60),
      sourceErrors,
      sources: {
        yelp: yelpRes.status === 'fulfilled' ? yelpRes.value.length : 0,
        here: hereRes.status === 'fulfilled' ? hereRes.value.length : 0,
        osm:  osmRes.status  === 'fulfilled' ? osmRes.value.length  : 0,
      },
    });

  } catch (error: any) {
    console.error('[Scraper] Fatal error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
