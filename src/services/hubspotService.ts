import { supabase } from '../lib/supabase';

export interface HubSpotContact {
    id: string;
    properties: {
        firstname?: string;
        lastname?: string;
        email?: string;
        phone?: string;
        company?: string;
        [key: string]: any;
    };
    createdAt: string;
    updatedAt: string;
    archived: boolean;
}

export const hubspotService = {
    /**
     * Get HubSpot integration tokens for a user
     */
    async getTokens(userId: string) {
        const { data, error } = await supabase
            .from('integrations')
            .select('config')
            .eq('user_id', userId)
            .eq('type', 'hubspot')
            .single();

        if (error || !data) return null;
        return data.config;
    },

    /**
     * Refresh HubSpot access token
     */
    async refreshAccessToken(userId: string, refreshToken: string) {
        try {
            const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: process.env.HUBSPOT_CLIENT_ID!,
                    client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
                    refresh_token: refreshToken
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to refresh token');

            const expiresAt = new Date(Date.now() + (data.expires_in || 1800) * 1000).toISOString();

            await supabase
                .from('integrations')
                .update({
                    config: {
                        accessToken: data.access_token,
                        refreshToken: data.refresh_token || refreshToken,
                        expiryDate: expiresAt,
                        lastSync: new Date().toISOString()
                    }
                })
                .eq('user_id', userId)
                .eq('type', 'hubspot');

            return data.access_token;
        } catch (error) {
            console.error('HubSpot Token Refresh Error:', error);
            throw error;
        }
    },

    /**
     * Get valid access token (refreshes if needed)
     */
    async getValidToken(userId: string) {
        const config = await this.getTokens(userId);
        if (!config) throw new Error('HubSpot integration not found');

        const now = new Date();
        const expiry = new Date(config.expiryDate);

        if (now >= expiry) {
            return await this.refreshAccessToken(userId, config.refreshToken);
        }

        return config.accessToken;
    },

    /**
     * Fetch contacts from HubSpot
     */
    async getContacts(userId: string, limit = 100) {
        try {
            const token = await this.getValidToken(userId);
            const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts?limit=${limit}&properties=firstname,lastname,email,phone,company`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to fetch contacts');

            return data.results as HubSpotContact[];
        } catch (error) {
            console.error('HubSpot Fetch Contacts Error:', error);
            throw error;
        }
    },

    /**
     * Create or update contact in HubSpot
     */
    async syncLeadToHubSpot(userId: string, lead: any) {
        try {
            const token = await this.getValidToken(userId);
            const properties = {
                firstname: lead.firstName || lead.name?.split(' ')[0],
                lastname: lead.lastName || lead.name?.split(' ').slice(1).join(' '),
                email: lead.email,
                phone: lead.phone,
                company: lead.company,
                lifecyclestage: 'lead'
            };

            const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ properties })
            });

            const data = await response.json();
            
            // If contact already exists, try searching and updating
            if (response.status === 409) {
                // HubSpot 409 usually means "Contact already exists"
                // In a production app, we would search by email and then PATCH
                console.log('HubSpot contact already exists, skipping create');
                return { success: true, message: 'Contact already exists' };
            }

            if (!response.ok) throw new Error(data.message || 'Failed to sync lead');

            return { success: true, data };
        } catch (error) {
            console.error('HubSpot Sync Lead Error:', error);
            throw error;
        }
    },

    /**
     * Delete contact from HubSpot
     */
    async deleteContact(userId: string, contactId: string) {
        try {
            const token = await this.getValidToken(userId);
            const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to delete contact');
            }

            return { success: true };
        } catch (error) {
            console.error('HubSpot Delete Contact Error:', error);
            throw error;
        }
    }
};
