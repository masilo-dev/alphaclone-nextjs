/**
 * FREE Places Service — Drop-in replacement for googlePlacesService
 * 
 * Sources (all free, no paid API key required):
 *  1. Foursquare Places API — Free tier: 1,000 calls/day
 *  2. OpenStreetMap / Nominatim — Unlimited, respects rate limits
 *  3. Playwright Google Maps scraper — Zero cost browser scraping
 * 
 * Exports the same interface as googlePlacesService so it can be
 * swapped in everywhere with no other changes required.
 */

import { BrowserManager } from '@/lib/scraper/browserManager';
import * as cheerio from 'cheerio';

// ─── Shared output type (matches MappedPlaceLead from googlePlacesService) ───
export type MappedPlaceLead = {
  placeId: string;
  businessName: string;
  formattedAddress: string;
  phone: string;
  website: string;
  industry: string;
  lat?: number;
  lng?: number;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  source: 'Foursquare' | 'OpenStreetMap' | 'Google Maps Scrape' | 'Google Maps';
};

// ─── Geocode via Nominatim (free, no key) ────────────────────────────────────
async function geocodeLocation(
  location: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  if (!location?.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location.trim())}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AlphaClone-LeadFinder/2.0 (support@alphaclonesystems.com)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.[0]) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name || location,
    };
  } catch {
    return null;
  }
}

// ─── Source 1: Foursquare Places API (free tier, no billing required) ────────
async function fetchFoursquare(
  niche: string,
  location: string,
  maxResults = 20,
  radiusKm = 25
): Promise<MappedPlaceLead[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) throw new Error('Foursquare API key not configured');

  const geo = await geocodeLocation(location);
  if (!geo) throw new Error(`Foursquare: could not geocode "${location}"`);

  const radiusM = Math.min(Math.max(radiusKm * 1000, 100), 100000);
  const url = new URL('https://api.foursquare.com/v3/places/search');
  url.searchParams.set('query', niche);
  url.searchParams.set('ll', `${geo.lat},${geo.lng}`);
  url.searchParams.set('radius', String(radiusM));
  url.searchParams.set('limit', String(Math.min(maxResults, 50)));
  url.searchParams.set('fields', 'fsq_id,name,location,tel,website,categories,rating,stats,geocodes');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      Authorization: apiKey,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Foursquare error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const results: MappedPlaceLead[] = [];

  for (const place of data.results || []) {
    const addr = place.location;
    const addressStr = [
      addr?.address,
      addr?.locality,
      addr?.region,
      addr?.country,
    ].filter(Boolean).join(', ');

    results.push({
      placeId: place.fsq_id || '',
      businessName: place.name || 'Unknown',
      formattedAddress: addressStr,
      phone: place.tel || '',
      website: place.website || '',
      industry: place.categories?.[0]?.name || 'Business',
      lat: place.geocodes?.main?.latitude,
      lng: place.geocodes?.main?.longitude,
      rating: typeof place.rating === 'number' ? place.rating / 2 : undefined, // FSQ uses 0-10, convert to 0-5
      userRatingCount: place.stats?.total_ratings,
      source: 'Foursquare',
    });
  }

  return results;
}

// ─── Source 2: OpenStreetMap Overpass (already used — re-exported for parity) ─
async function fetchOSMPlaces(
  niche: string,
  location: string,
  maxResults = 20,
  radiusKm = 25
): Promise<MappedPlaceLead[]> {
  const geo = await geocodeLocation(location);
  if (!geo) throw new Error(`OSM: could not geocode "${location}"`);

  const delta = Math.min(Math.max(radiusKm / 111, 0.05), 2.0);
  const south = geo.lat - delta;
  const north = geo.lat + delta;
  const west = geo.lng - delta;
  const east = geo.lng + delta;
  const nicheEscaped = niche.replace(/["\\]/g, '');
  const limit = Math.min(maxResults * 3, 150);

  const q = `
[out:json][timeout:15];
(
  node["name"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["amenity"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["shop"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["office"~"${nicheEscaped}",i](${south},${west},${north},${east});
  node["craft"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["name"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["shop"~"${nicheEscaped}",i](${south},${west},${north},${east});
  way["amenity"~"${nicheEscaped}",i](${south},${west},${north},${east});
);
out center ${limit};
  `.trim();

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: q,
    headers: { 'Content-Type': 'text/plain' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Overpass error ${res.status}`);

  const data = await res.json();
  const results: MappedPlaceLead[] = [];

  for (const el of (data.elements || []).filter((e: any) => e.tags?.name)) {
    const addr = [
      el.tags['addr:housenumber'],
      el.tags['addr:street'],
      el.tags['addr:city'],
      el.tags['addr:country'],
    ].filter(Boolean).join(' ');

    results.push({
      placeId: `osm-${el.id}`,
      businessName: el.tags.name,
      formattedAddress: addr,
      phone: el.tags.phone || el.tags['contact:phone'] || '',
      website: el.tags.website || el.tags.url || el.tags['contact:website'] || '',
      industry: el.tags.amenity || el.tags.shop || el.tags.office || el.tags.craft || 'Business',
      lat: el.lat ?? el.center?.lat,
      lng: el.lon ?? el.center?.lon,
      source: 'OpenStreetMap',
    });

    if (results.length >= maxResults) break;
  }

  return results;
}

// ─── Source 3: Playwright Google Maps Scraper (zero cost, no API key) ─────────
async function fetchGoogleMapsScrape(
  niche: string,
  location: string,
  maxResults = 20
): Promise<MappedPlaceLead[]> {
  if (!BrowserManager.hasRemoteConfigured()) {
    // Try local Playwright if no remote browser
    return [];
  }

  const query = `${niche} in ${location}`;
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

  const { page, close } = await BrowserManager.createPage();
  const results: MappedPlaceLead[] = [];

  try {
    await page.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    // Wait for results panel
    await page.waitForSelector('[role="feed"], .Nv2PK', { timeout: 12000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 3000));

    // Scroll to load more results
    await page.evaluate(() => {
      const feed = document.querySelector('[role="feed"]');
      if (feed) feed.scrollTop = feed.scrollHeight;
    }).catch(() => null);
    await new Promise(r => setTimeout(r, 1500));

    const html = await page.content();
    const $ = cheerio.load(html);

    // Extract business cards from Google Maps results
    $('[role="article"], .Nv2PK').each((_, el) => {
      if (results.length >= maxResults) return false;

      const nameEl = $(el).find('.qBF1Pd, .fontHeadlineSmall, h3').first();
      const name = nameEl.text().trim();
      if (!name || name.length < 2) return;

      const ratingEl = $(el).find('.MW4etd').first();
      const ratingText = ratingEl.text().trim();
      const rating = ratingText ? parseFloat(ratingText) : undefined;

      const reviewEl = $(el).find('.UY7F9').first();
      const reviewText = reviewEl.text().replace(/[()]/g, '').trim();
      const reviewCount = reviewText ? parseInt(reviewText.replace(/,/g, ''), 10) : undefined;

      const categoryEl = $(el).find('.W4Efsd:first-of-type .W4Efsd span').first();
      const category = categoryEl.text().replace(/·/g, '').trim() || 'Business';

      const addressEl = $(el).find('[data-tooltip="Copy address"], .W4Efsd:last-of-type span').first();
      const address = addressEl.text().trim();

      // Build Maps link
      const linkEl = $(el).find('a[href*="/maps/place/"]').first();
      const mapsLink = linkEl.attr('href') || '';

      results.push({
        placeId: `gmaps-${Buffer.from(name).toString('base64').slice(0, 16)}`,
        businessName: name,
        formattedAddress: address,
        phone: '',
        website: '',
        industry: category,
        rating: !isNaN(rating!) ? rating : undefined,
        userRatingCount: !isNaN(reviewCount!) ? reviewCount : undefined,
        googleMapsUri: mapsLink ? `https://www.google.com${mapsLink}` : undefined,
        source: 'Google Maps Scrape',
      });
    });

    return results;
  } catch (err) {
    console.warn('[FreePlaces] Google Maps scrape failed:', err);
    return [];
  } finally {
    await close().catch(() => null);
  }
}

// ─── Main service — same API surface as googlePlacesService ──────────────────
export const freePlacesService = {
  /**
   * Search for places using free sources.
   * Tries Foursquare → OSM → Google Maps Scrape in order.
   */
  async searchPlaces(
    query: string,
    _apiKey?: string, // kept for interface compatibility, not used
    options?: { maxResultCount?: number }
  ): Promise<{ places: MappedPlaceLead[]; rawResults?: unknown[]; error: string | null }> {
    const maxResults = Math.min(Math.max(options?.maxResultCount ?? 10, 1), 50);
    // Extract niche and location from query ("plumbers in Cape Town")
    const parts = query.split(/\s+in\s+/i);
    const niche = parts[0]?.trim() || query;
    const location = parts[1]?.trim() || 'United States';

    return this.searchPlacesForLeads(niche, location, undefined, { maxResults });
  },

  /**
   * Full lead search with geocoding + radius.
   * Drop-in replacement for googlePlacesService.searchPlacesForLeads()
   */
  async searchPlacesForLeads(
    niche: string,
    location: string,
    _apiKey?: string, // kept for interface compatibility
    options?: { radiusKm?: number; maxResults?: number }
  ): Promise<{
    places: MappedPlaceLead[];
    locationValidated: boolean;
    formattedLocation?: string;
    geocodeError?: string | null;
    error: string | null;
  }> {
    const maxResults = Math.min(Math.max(options?.maxResults ?? 20, 1), 50);
    const radiusKm = Math.min(Math.max(options?.radiusKm ?? 25, 1), 100);
    const allPlaces: MappedPlaceLead[] = [];
    const errors: string[] = [];

    // Validate location via Nominatim
    const geo = await geocodeLocation(location);

    // ── Source 1: Foursquare (best data quality, free 1k/day) ──────────────
    try {
      const fsqPlaces = await fetchFoursquare(niche, location, maxResults, radiusKm);
      allPlaces.push(...fsqPlaces);
      console.log(`[FreePlaces] Foursquare: ${fsqPlaces.length} results`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[FreePlaces] Foursquare failed:', msg);
      errors.push(`Foursquare: ${msg}`);
    }

    // ── Source 2: OSM Overpass (always free, unlimited) ─────────────────────
    if (allPlaces.length < maxResults) {
      try {
        const osmPlaces = await fetchOSMPlaces(niche, location, maxResults - allPlaces.length, radiusKm);
        // Deduplicate by name
        const existingNames = new Set(allPlaces.map(p => p.businessName.toLowerCase()));
        const newOsm = osmPlaces.filter(p => !existingNames.has(p.businessName.toLowerCase()));
        allPlaces.push(...newOsm);
        console.log(`[FreePlaces] OSM: ${newOsm.length} unique results`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[FreePlaces] OSM failed:', msg);
        errors.push(`OSM: ${msg}`);
      }
    }

    // ── Source 3: Google Maps Scrape (browser-based, no API cost) ─────────
    if (allPlaces.length < maxResults && BrowserManager.hasRemoteConfigured()) {
      try {
        const scrapedPlaces = await fetchGoogleMapsScrape(niche, location, maxResults - allPlaces.length);
        const existingNames = new Set(allPlaces.map(p => p.businessName.toLowerCase()));
        const newScraped = scrapedPlaces.filter(p => !existingNames.has(p.businessName.toLowerCase()));
        allPlaces.push(...newScraped);
        console.log(`[FreePlaces] Google Maps scrape: ${newScraped.length} unique results`);
      } catch (err) {
        console.warn('[FreePlaces] Google Maps scrape failed:', err);
      }
    }

    return {
      places: allPlaces.slice(0, maxResults),
      locationValidated: !!geo,
      formattedLocation: geo?.displayName,
      geocodeError: !geo && location ? `Could not geocode "${location}" — results may be less precise` : null,
      error: allPlaces.length === 0 && errors.length > 0 ? errors.join('; ') : null,
    };
  },
};

// ─── Backwards-compat alias ───────────────────────────────────────────────────
// Allows: import { googlePlacesService } from '@/services/freePlacesService'
export { freePlacesService as googlePlacesService };
