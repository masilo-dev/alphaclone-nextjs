/**
 * Google Places API (New) + Geocoding for lead discovery.
 * Requires Maps Platform key with Places API (New) and Geocoding API enabled.
 */

interface PlaceResult {
  id?: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
  types?: string[];
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
}

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
  source: 'Google Maps';
};

const PLACES_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.businessStatus,places.types,places.location,places.rating,places.userRatingCount,places.googleMapsUri';

function humanizeType(type: string): string {
  if (!type) return 'Business';
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Validates and resolves a free-text location using the Geocoding API.
 */
export async function validateGeocodeLocation(
  address: string,
  apiKey: string
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  if (!address?.trim() || !apiKey) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address.trim())}&key=${apiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      status?: string;
      results?: Array<{ formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } }>;
    };
    if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
      return null;
    }
    const loc = data.results[0].geometry.location;
    return {
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: data.results[0].formatted_address || address.trim(),
    };
  } catch (e) {
    console.error('[googlePlaces] geocode error:', e);
    return null;
  }
}

function mapPlace(place: PlaceResult): MappedPlaceLead | null {
  const placeId = place.id || '';
  if (!placeId) return null;
  return {
    placeId,
    businessName: place.displayName?.text || 'Unknown Business',
    formattedAddress: place.formattedAddress || '',
    phone: place.nationalPhoneNumber || '',
    website: place.websiteUri || '',
    industry: humanizeType(place.types?.[0] || ''),
    lat: place.location?.latitude,
    lng: place.location?.longitude,
    rating: typeof place.rating === 'number' ? place.rating : undefined,
    userRatingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : undefined,
    googleMapsUri: place.googleMapsUri,
    source: 'Google Maps',
  };
}

export const googlePlacesService = {
  /**
   * Search for places using Google Places Text Search (New).
   */
  async searchPlaces(
    query: string,
    apiKey: string,
    options?: { maxResultCount?: number }
  ): Promise<{ places: MappedPlaceLead[]; rawResults?: PlaceResult[]; error: string | null }> {
    if (!apiKey) {
      return { places: [], error: 'API Key is missing' };
    }

    const maxResultCount = Math.min(Math.max(options?.maxResultCount ?? 10, 1), 20);

    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': PLACES_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('Google Places API Error:', errData);
        throw new Error(
          (errData as { error?: { message?: string } })?.error?.message || 'Failed to fetch from Google Places'
        );
      }

      const data = (await response.json()) as { places?: PlaceResult[] };

      if (!data.places || data.places.length === 0) {
        return { places: [], rawResults: [], error: null };
      }

      const mappedPlaces = data.places.map(mapPlace).filter((p): p is MappedPlaceLead => p !== null);

      return { places: mappedPlaces, rawResults: data.places, error: null };
    } catch (error) {
      console.error('Search Places Exception:', error);
      return { places: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  /**
   * Geocode the location, then run Text Search with optional circular bias.
   * Falls back to text-only query if geocoding fails (still searches, less precise).
   */
  async searchPlacesForLeads(
    niche: string,
    location: string,
    apiKey: string,
    options?: { radiusKm?: number; maxResults?: number }
  ): Promise<{
    places: MappedPlaceLead[];
    locationValidated: boolean;
    formattedLocation?: string;
    geocodeError?: string | null;
    error: string | null;
  }> {
    const nicheTrim = niche?.trim() || 'business';
    const locTrim = location?.trim() || '';
    if (!apiKey) {
      return {
        places: [],
        locationValidated: false,
        error: 'Google API key is not configured (set GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY)',
      };
    }

    const maxResults = Math.min(Math.max(options?.maxResults ?? 15, 1), 20);
    const radiusM = Math.min(Math.max((options?.radiusKm ?? 25) * 1000, 1000), 50000);

    const geo = locTrim ? await validateGeocodeLocation(locTrim, apiKey) : null;
    const locationValidated = !!geo;
    const geocodeError = locTrim && !geo ? 'Geocoding returned no results for this location string' : null;

    const textQuery = geo
      ? `${nicheTrim} near ${geo.formattedAddress}`
      : `${nicheTrim} in ${locTrim || 'United States'}`;

    try {
      const body: Record<string, unknown> = {
        textQuery,
        maxResultCount: maxResults,
      };

      if (geo) {
        body.locationBias = {
          circle: {
            center: { latitude: geo.lat, longitude: geo.lng },
            radius: radiusM,
          },
        };
      }

      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': PLACES_FIELD_MASK,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg =
          (errData as { error?: { message?: string; status?: string } })?.error?.message ||
          `Places HTTP ${response.status}`;
        return {
          places: [],
          locationValidated,
          formattedLocation: geo?.formattedAddress,
          geocodeError,
          error: msg,
        };
      }

      const data = (await response.json()) as { places?: PlaceResult[] };
      const raw = data.places || [];
      const mapped = raw.map(mapPlace).filter((p): p is MappedPlaceLead => p !== null);

      if (mapped.length === 0 && geo) {
        const fallback = await this.searchPlaces(`${nicheTrim} in ${locTrim}`, apiKey, {
          maxResultCount: maxResults,
        });
        return {
          places: fallback.places,
          locationValidated,
          formattedLocation: geo.formattedAddress,
          geocodeError,
          error: fallback.error,
        };
      }

      return {
        places: mapped,
        locationValidated,
        formattedLocation: geo?.formattedAddress,
        geocodeError,
        error: null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return {
        places: [],
        locationValidated: !!geo,
        formattedLocation: geo?.formattedAddress,
        geocodeError,
        error: msg,
      };
    }
  },
};
