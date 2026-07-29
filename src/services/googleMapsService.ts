/**
 * Google Maps Service
<<<<<<< HEAD
 * Compatibility facade backed by HERE Maps with OpenStreetMap fallback.
=======
 * DISABLED: System transitioned to HERE Maps and OSM.
>>>>>>> origin/main
 */

export interface LatLng {
    lat: number;
    lng: number;
}

export const googleMapsService = {
    /**
     * Geocode an address to LatLng
     * DISABLED: System transitioned to HERE Maps and OSM.
     */
<<<<<<< HEAD
    async geocode(address: string, _apiKey?: string): Promise<LatLng | null> {
        const result = await this.validateAddress(address);
        return result.valid && result.location ? result.location : null;
=======
    async geocode(_address: string, _apiKey: string): Promise<LatLng | null> {
        console.warn('googleMapsService.geocode is disabled.');
        return null;
>>>>>>> origin/main
    },

    /**
     * Validate an address using Google Address Validation API
     * DISABLED: System transitioned to HERE Maps and OSM.
     */
<<<<<<< HEAD
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
=======
    async validateAddress(_address: string, _apiKey: string) {
        return { 
            valid: false, 
            formattedAddress: undefined as string | undefined,
            location: undefined as { lat: number; lng: number } | undefined,
            error: 'Google Maps Service is disabled. System is now powered by HERE Maps and OpenStreetMap (SOM).' 
        };
    },

    /**
     * Get Street View metadata check
     * DISABLED: System transitioned to HERE Maps and OSM.
     */
    async hasStreetView(_lat: number, _lng: number, _apiKey: string): Promise<boolean> {
        return false;
    }
>>>>>>> origin/main
};
