/**
 * Google Places Service
 * Handles interaction with Google Places API (New) for searching businesses.
 */

interface PlaceResult {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    websiteUri?: string;
    businessStatus?: string;
    types?: string[];
}

export const googlePlacesService = {
    /**
     * Search for places using Google Places Text Search (New)
     * @param query Search query (e.g. "Construction companies in Harare")
     * @param apiKey Google Places API Key
     */
    async searchPlaces(query: string, apiKey: string): Promise<{ places: any[]; error: string | null }> {
        if (!apiKey) {
            return { places: [], error: 'API Key is missing' };
        }

        try {
            const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.businessStatus,places.types'
                },
                body: JSON.stringify({
                    textQuery: query,
                    maxResultCount: 10 // Start with 10 for safety/quota
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                console.error('Google Places API Error:', errData);
                throw new Error(errData.error?.message || 'Failed to fetch from Google Places');
            }

            const data = await response.json();

            if (!data.places || data.places.length === 0) {
                return { places: [], error: null };
            }

            // Map to our internal Lead format
            const mappedPlaces = data.places.map((place: PlaceResult) => ({
                businessName: place.displayName?.text || 'Unknown Business',
                location: place.formattedAddress || 'Unknown Location',
                phone: place.nationalPhoneNumber || '',
                website: place.websiteUri || '',
                industry: humanizeType(place.types?.[0] || ''),
                source: 'Google Maps'
            }));

            return { places: mappedPlaces, error: null };

        } catch (error) {
            console.error('Search Places Exception:', error);
            return { places: [], error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
};

// Helper to make "consultant_contractor" -> "Consultant Contractor"
function humanizeType(type: string): string {
    if (!type) return 'Business';
    return type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
