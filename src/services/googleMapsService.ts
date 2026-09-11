/**
 * Google Maps Service
 * Compatibility facade backed by HERE Maps with OpenStreetMap fallback.
 */

export interface LatLng {
    lat: number;
    lng: number;
}

export const googleMapsService = {
    /**
     * Geocode an address to LatLng
     */
    async geocode(address: string, _apiKey?: string): Promise<LatLng | null> {
        const result = await this.validateAddress(address);
        return result.valid && result.location ? result.location : null;
    },

    /**
     * Validate an address using Google Address Validation API
     * DISABLED: System transitioned to HERE Maps and OSM.
     */
    async validateAddress(address: string, _apiKey?: string) {
        try {
            const response = await fetch('/api/location/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address }),
            });
            const payload = await response.json().catch(() => ({}));
            return {
                valid: Boolean(response.ok && payload.valid),
                formattedAddress: payload.formattedAddress as string | undefined,
                location: payload.location as { lat: number; lng: number } | undefined,
                error: response.ok ? undefined : payload.error || 'Address could not be validated',
            };
        } catch (error) {
            return { valid: false, error: error instanceof Error ? error.message : 'Address validation failed' };
        }
    },
};
