import { activityService } from './activityService';

interface IPLocation {
    ip: string;
    city: string;
    region: string;
    country: string;
    org: string;
}

export const ipTrackingService = {
    async getClientIP(): Promise<IPLocation | null> {
        try {
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            return {
                ip: data.ip,
                city: data.city,
                region: data.region,
                country: data.country_name,
                org: data.org
            };
        } catch (error) {
            // detailed error for debugging but warn to avoid overlay
            console.warn('Unable to fetch IP location (non-critical):', error instanceof Error ? error.message : error);
            return null;
        }
    },

    async trackLogin(userId: string) {
        const location = await this.getClientIP();
        if (location) {
            await activityService.logActivity(userId, 'Login', {
                ip: location.ip,
                location: `${location.city}, ${location.region}, ${location.country}`,
                device: navigator.userAgent
            });

            // Check for suspicious locations (mock logic for now)
            // In a real app, compare with user's known locations
        }
    }
};
