import { activityService } from './activityService';

export interface IPLocation {
    ip: string;
    city: string;
    region: string;
    country: string;
    country_name: string;
    org: string;
}

export const ipTrackingService = {
    async getClientIP(): Promise<IPLocation | null> {
        // IP collection is strictly disabled per privacy policy
        return null;
        /*
        try {
            // Call our internal proxy to avoid CORS issues
            const response = await fetch('/api/ip-location');

            if (!response.ok) {
                console.warn('Unable to fetch IP location from internal proxy');
                return null;
            }

            const data = await response.json();
            return {
                ip: data.ip,
                city: data.city,
                region: data.region,
                country: data.country_code || data.country, // Handle both formats
                country_name: data.country_name,
                org: data.org
            };
        } catch (error) {
            console.warn('Unable to fetch IP location:', error);
            return null;
        }
        */
    },

    async trackLogin(userId: string) {
        const location = await this.getClientIP();
        if (location) {
            await activityService.logActivity(userId, 'Login', {
                ip: location.ip,
                location: location.city && location.country_name !== 'Unknown'
                    ? `${location.city}, ${location.region}, ${location.country_name}`
                    : 'Unknown Location',
                country: location.country_name,
                device: navigator.userAgent
            });
        }
    }
};
