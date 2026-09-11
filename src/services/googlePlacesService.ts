/**
 * Google Places API (New) + Geocoding for lead discovery.
 * DISABLED: System transitioned to HERE Maps and OSM.
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
  countryCode?: string;
};

export const googlePlacesService = {
  /**
   * Search for places using Google Places Text Search (New).
   * DISABLED: System transitioned to HERE Maps and OSM.
   */
  async searchPlaces(
    _query: string,
    _apiKey: string,
    _options?: { maxResultCount?: number }
  ): Promise<{ places: MappedPlaceLead[]; rawResults?: PlaceResult[]; error: string | null }> {
    return { 
      places: [], 
      error: 'Google Places API is disabled. System is now powered by HERE Maps and OpenStreetMap (SOM).' 
    };
  },

  /**
   * Geocode the location, then run Text Search with optional circular bias.
   * DISABLED: System transitioned to HERE Maps and OSM.
   */
  async searchPlacesForLeads(
    _niche: string,
    _location: string,
    _apiKey: string,
    _options?: { radiusKm?: number; maxResults?: number }
  ): Promise<{
    places: MappedPlaceLead[];
    locationValidated: boolean;
    formattedLocation?: string;
    geocodeError?: string | null;
    error: string | null;
  }> {
    return {
      places: [],
      locationValidated: false,
      error: 'Google Places API is disabled. System is now powered by HERE Maps and OpenStreetMap (SOM).',
    };
  },
};
