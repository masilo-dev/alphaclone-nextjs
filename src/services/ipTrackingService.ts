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
        try {
            // Try primary service
            const response = await fetch('https://ipapi.co/json/');

            if (!response.ok) {
                // Fallback service (simplified)
                try {
                    const fallback = await fetch('https://api.ipify.org?format=json');
                    const data = await fallback.json();
                    return {
                        ip: data.ip,
                        city: 'Unknown',
                        region: 'Unknown',
                        country: 'Unknown',
                        country_name: 'Unknown',
                        org: 'Unknown'
                    };
                } catch (e) {
                    return null;
                }
            }

            const data = await response.json();
            return {
                ip: data.ip,
                city: data.city,
                region: data.region,
                country: data.country_code, // ISO code
                country_name: data.country_name,
                org: data.org
            };
        } catch (error) {
            console.warn('Unable to fetch IP location:', error);
            return null;
        }
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
