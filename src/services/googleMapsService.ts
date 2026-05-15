/**
 * Google Maps Service
 * DISABLED: System transitioned to HERE Maps and OSM.
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
    async geocode(_address: string, _apiKey: string): Promise<LatLng | null> {
        console.warn('googleMapsService.geocode is disabled.');
        return null;
    },

    /**
     * Validate an address using Google Address Validation API
     * DISABLED: System transitioned to HERE Maps and OSM.
     */
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
};
