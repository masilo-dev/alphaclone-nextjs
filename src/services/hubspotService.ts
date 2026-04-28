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

function splitNameParts(value: string | undefined) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        return { firstName: undefined, lastName: undefined };
    }

    const parts = trimmed.split(/\s+/);
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ') || undefined,
    };
}

function normalizeHubSpotLead(lead: any) {
    const displayName =
        lead?.name ||
        lead?.fullName ||
        lead?.businessName ||
        lead?.company ||
        [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') ||
        '';
    const name = splitNameParts(displayName);

    return {
        firstName: lead?.firstName || name.firstName,
        lastName: lead?.lastName || name.lastName || 'Unknown',
        email: typeof lead?.email === 'string' ? lead.email.trim() : '',
        phone: lead?.phone || lead?.mobile || undefined,
        company:
            lead?.company ||
            lead?.companyName ||
            lead?.businessName ||
            lead?.name ||
            undefined,
    };
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

    async findContactByEmail(userId: string, email: string) {
        const token = await this.getValidToken(userId);
        const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filterGroups: [
                    {
                        filters: [
                            {
                                propertyName: 'email',
                                operator: 'EQ',
                                value: email
                            }
                        ]
                    }
                ],
                properties: ['firstname', 'lastname', 'email', 'phone', 'company'],
                limit: 1
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to search contacts');
        return data.results?.[0] || null;
    },

    async updateContact(userId: string, contactId: string, properties: Record<string, any>) {
        const token = await this.getValidToken(userId);
        const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ properties })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update contact');
        return data;
    },

    /**
     * Create or update contact in HubSpot
     */
    async syncLeadToHubSpot(userId: string, lead: any) {
        try {
            const token = await this.getValidToken(userId);
            const normalized = normalizeHubSpotLead(lead);

            if (!normalized.email) {
                return { success: false, skipped: true, message: 'Contact email is required for HubSpot sync' };
            }

            const properties = {
                firstname: normalized.firstName,
                lastname: normalized.lastName,
                email: normalized.email,
                phone: normalized.phone,
                company: normalized.company,
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
            
            if (response.status === 409) {
                const existing = await this.findContactByEmail(userId, normalized.email);
                if (!existing?.id) {
                    return { success: true, message: 'Contact already exists' };
                }

                const updated = await this.updateContact(userId, existing.id, properties);
                return { success: true, data: updated, message: 'Contact updated' };
            }

            if (!response.ok) throw new Error(data.message || 'Failed to sync lead');

            return { success: true, data };
        } catch (error) {
            console.error('HubSpot Sync Lead Error:', error);
            throw error;
        }
    },

    async syncContactToHubSpot(userId: string, contact: any) {
        try {
            const normalized = normalizeHubSpotLead(contact);
            const properties = {
                firstname: normalized.firstName,
                lastname: normalized.lastName,
                email: normalized.email,
                phone: normalized.phone,
                company: normalized.company,
                lifecyclestage: 'lead'
            };

            if (!properties.email) {
                throw new Error('Contact email is required for HubSpot sync');
            }

            const existing = await this.findContactByEmail(userId, properties.email);
            if (existing?.id) {
                const updated = await this.updateContact(userId, existing.id, properties);
                return { success: true, data: updated, message: 'Contact updated' };
            }

            return await this.syncLeadToHubSpot(userId, properties);
        } catch (error) {
            console.error('HubSpot Sync Contact Error:', error);
            throw error;
        }
    },

    async findCompany(userId: string, company: { website?: string; name?: string }) {
        const token = await this.getValidToken(userId);
        const filters = [];
        const domain = String(company.website || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];

        if (domain) {
            filters.push({
                propertyName: 'domain',
                operator: 'EQ',
                value: domain
            });
        }
        if (company.name) {
            filters.push({
                propertyName: 'name',
                operator: 'EQ',
                value: company.name
            });
        }
        if (filters.length === 0) return null;

        const response = await fetch('https://api.hubapi.com/crm/v3/objects/companies/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filterGroups: filters.map((filter) => ({ filters: [filter] })),
                properties: ['name', 'domain', 'phone', 'industry'],
                limit: 1
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to search companies');
        return data.results?.[0] || null;
    },

    async createCompany(userId: string, properties: Record<string, any>) {
        const token = await this.getValidToken(userId);
        const response = await fetch('https://api.hubapi.com/crm/v3/objects/companies', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ properties })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to create company');
        return data;
    },

    async updateCompany(userId: string, companyId: string, properties: Record<string, any>) {
        const token = await this.getValidToken(userId);
        const response = await fetch(`https://api.hubapi.com/crm/v3/objects/companies/${companyId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ properties })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update company');
        return data;
    },

    async syncCompanyToHubSpot(userId: string, company: any) {
        try {
            const domain = String(company.website || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
            const properties = {
                name: company.name || company.businessName,
                domain: domain || undefined,
                phone: company.phone,
                industry: company.industry,
                description: company.description || company.notes
            };

            if (!properties.name) {
                throw new Error('Company name is required for HubSpot sync');
            }

            const existing = await this.findCompany(userId, { website: company.website, name: properties.name });
            if (existing?.id) {
                const updated = await this.updateCompany(userId, existing.id, properties);
                return { success: true, data: updated, message: 'Company updated' };
            }

            const created = await this.createCompany(userId, properties);
            return { success: true, data: created, message: 'Company created' };
        } catch (error) {
            console.error('HubSpot Sync Company Error:', error);
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
