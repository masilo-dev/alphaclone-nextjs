/**
 * Keyless free geo / company discovery helpers.
 * Sources: Nominatim, Photon (Komoot), Wikidata SPARQL — no paid APIs.
 */

export type GeoPoint = { lat: number; lng: number; displayName: string };

const UA = 'AlphaClone-LeadFinder/3.0 (support@alphaclonesystems.com)';

export async function geocodeNominatim(location: string): Promise<GeoPoint | null> {
  const cleaned = location.trim();
  if (!cleaned) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleaned)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    if (!data?.[0]) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name || cleaned,
    };
  } catch {
    return null;
  }
}

/** Photon (Komoot) — free OSM-based geocoder, good typo tolerance. */
export async function geocodePhoton(location: string): Promise<GeoPoint | null> {
  const cleaned = location.trim();
  if (!cleaned) return null;
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleaned)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: { name?: string; city?: string; country?: string };
      }>;
    };
    const feature = data.features?.[0];
    const coords = feature?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const [lng, lat] = coords;
    const props = feature?.properties || {};
    const displayName = [props.name, props.city, props.country].filter(Boolean).join(', ') || cleaned;
    return { lat, lng, displayName };
  } catch {
    return null;
  }
}

/** Geocode with Nominatim → Photon fallback (both free/open). */
export async function geocodeFree(location: string): Promise<GeoPoint | null> {
  const primary = await geocodeNominatim(location);
  if (primary) return primary;
  return geocodePhoton(location);
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type WikidataOrg = {
  name: string;
  website?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  wikidataId: string;
};

/**
 * Wikidata SPARQL — free companies / orgs by industry keyword + optional city.
 * Inspired by OpenLeads `companies` source (keyless).
 */
export async function fetchWikidataOrgs(
  niche: string,
  location: string,
  limit = 15
): Promise<WikidataOrg[]> {
  const nicheEsc = niche.replace(/"/g, '').slice(0, 60);
  const cityHint = location.split(',')[0]?.trim().replace(/"/g, '').slice(0, 60) || '';
  const cityFilter = cityHint
    ? `FILTER(CONTAINS(LCASE(STR(?cityLabel)), LCASE("${cityHint}")) || CONTAINS(LCASE(STR(?label)), LCASE("${cityHint}")))`
    : '';

  const query = `
SELECT DISTINCT ?item ?itemLabel ?website ?cityLabel ?countryLabel ?lat ?lng WHERE {
  ?item wdt:P31/wdt:P279* wd:Q4830453 .
  ?item rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  FILTER(CONTAINS(LCASE(?label), LCASE("${nicheEsc}")))
  OPTIONAL { ?item wdt:P856 ?website . }
  OPTIONAL { ?item wdt:P159 ?hq . ?hq rdfs:label ?cityLabel . FILTER(LANG(?cityLabel) = "en") }
  OPTIONAL { ?item wdt:P17 ?country . ?country rdfs:label ?countryLabel . FILTER(LANG(?countryLabel) = "en") }
  OPTIONAL {
    ?item p:P625/psv:P625 [
      wikibase:geoLatitude ?lat ;
      wikibase:geoLongitude ?lng
    ] .
  }
  ${cityFilter}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${Math.min(Math.max(limit, 1), 30)}
`.trim();

  try {
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/sparql-results+json',
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: {
        bindings?: Array<Record<string, { value?: string }>>;
      };
    };
    const bindings = data.results?.bindings || [];
    return bindings
      .map((b) => {
        const id = (b.item?.value || '').split('/').pop() || '';
        return {
          name: b.itemLabel?.value || b.label?.value || '',
          website: b.website?.value,
          city: b.cityLabel?.value,
          country: b.countryLabel?.value,
          lat: b.lat?.value ? parseFloat(b.lat.value) : undefined,
          lng: b.lng?.value ? parseFloat(b.lng.value) : undefined,
          wikidataId: id,
        };
      })
      .filter((o) => o.name.length > 1);
  } catch (err) {
    console.warn('[freeGeoSources] Wikidata SPARQL failed:', err);
    return [];
  }
}
