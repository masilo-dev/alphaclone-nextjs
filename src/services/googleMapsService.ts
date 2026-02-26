/**
 * Google Maps Service
 * Handles Geocoding, Address Validation, and 3D Maps utilities.
 */

export interface LatLng {
    lat: number;
    lng: number;
}

export const googleMapsService = {
    /**
     * Geocode an address to LatLng
     */
    async geocode(address: string, apiKey: string): Promise<LatLng | null> {
        if (!apiKey) return null;
        try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                return data.results[0].geometry.location;
            }
            return null;
        } catch (error) {
            console.error('Geocoding error:', error);
            return null;
        }
    },

    /**
     * Validate an address using Google Address Validation API
     */
    async validateAddress(address: string, apiKey: string) {
        if (!apiKey) return { valid: false, error: 'API Key missing' };
        try {
            const response = await fetch(`https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: {
                        addressLines: [address]
                    }
                })
            });

            if (!response.ok) throw new Error('Validation failed');
            const data = await response.json();

            return {
                valid: data.result?.verdict?.addressComplete || false,
                formattedAddress: data.result?.address?.formattedAddress,
                location: data.result?.geocode?.location,
                metadata: data.result?.metadata
            };
        } catch (error) {
            console.error('Address validation error:', error);
            return { valid: false, error: 'Request failed' };
        }
    },

    /**
     * Get Street View metadata check
     */
    async hasStreetView(lat: number, lng: number, apiKey: string): Promise<boolean> {
        try {
            const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();
            return data.status === 'OK';
        } catch {
            return false;
        }
    }
};
