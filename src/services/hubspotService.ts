import { supabase } from '../lib/supabase';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  getHubSpotTokens,
  getValidHubSpotAccessToken,
  refreshHubSpotAccessToken,
} from '@/services/hubspot/hubspotIntegrationService';

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
    async getTokens(userId: string, tenantId: string) {
        const admin = createSupabaseAdminClient();
        const tokens = await getHubSpotTokens(admin, userId, tenantId);
        if (!tokens) return null;
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiryDate: tokens.expiryDate,
            portalId: tokens.portalId,
        };
    },

    /**
     * Refresh HubSpot access token
     */
    async refreshAccessToken(userId: string, tenantId: string, _refreshToken?: string) {
        const admin = createSupabaseAdminClient();
        return refreshHubSpotAccessToken(admin, userId, tenantId);
    },

    /**
     * Get valid access token (refreshes if needed)
     */
    async getValidToken(userId: string, tenantId: string) {
        const admin = createSupabaseAdminClient();
        return getValidHubSpotAccessToken(admin, userId, tenantId);
    },

    /**
     * Fetch contacts from HubSpot
     */
    async getContacts(userId: string, tenantId: string, limit = 100) {
        try {
            const token = await this.getValidToken(userId, tenantId);
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

    async findContactByEmail(userId: string, tenantId: string, email: string) {
        const token = await this.getValidToken(userId, tenantId);
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

    async updateContact(userId: string, tenantId: string, contactId: string, properties: Record<string, any>) {
        const token = await this.getValidToken(userId, tenantId);
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
    async syncLeadToHubSpot(userId: string, tenantId: string, lead: any) {
        try {
<<<<<<< HEAD
            const token = await this.getValidToken(userId, tenantId);
=======
            const token = await this.getValidToken(userId);
>>>>>>> origin/main
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
<<<<<<< HEAD
                const existing = await this.findContactByEmail(userId, tenantId, normalized.email);
=======
                const existing = await this.findContactByEmail(userId, normalized.email);
>>>>>>> origin/main
                if (!existing?.id) {
                    return { success: true, message: 'Contact already exists' };
                }

                const updated = await this.updateContact(userId, tenantId, existing.id, properties);
                return { success: true, data: updated, message: 'Contact updated' };
            }

            if (!response.ok) throw new Error(data.message || 'Failed to sync lead');

            return { success: true, data };
        } catch (error) {
            console.error('HubSpot Sync Lead Error:', error);
            throw error;
        }
    },

<<<<<<< HEAD
    async syncContactToHubSpot(userId: string, tenantId: string, contact: any) {
=======
    async syncContactToHubSpot(userId: string, contact: any) {
>>>>>>> origin/main
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

<<<<<<< HEAD
            const existing = await this.findContactByEmail(userId, tenantId, properties.email);
            if (existing?.id) {
                const updated = await this.updateContact(userId, tenantId, existing.id, properties);
                return { success: true, data: updated, message: 'Contact updated' };
            }

            return await this.syncLeadToHubSpot(userId, tenantId, properties);
=======
            const existing = await this.findContactByEmail(userId, properties.email);
            if (existing?.id) {
                const updated = await this.updateContact(userId, existing.id, properties);
                return { success: true, data: updated, message: 'Contact updated' };
            }

            return await this.syncLeadToHubSpot(userId, properties);
>>>>>>> origin/main
        } catch (error) {
            console.error('HubSpot Sync Contact Error:', error);
            throw error;
        }
    },

<<<<<<< HEAD
    async findCompany(userId: string, tenantId: string, company: { website?: string; name?: string }) {
        const token = await this.getValidToken(userId, tenantId);
=======
    async findCompany(userId: string, company: { website?: string; name?: string }) {
        const token = await this.getValidToken(userId);
>>>>>>> origin/main
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

<<<<<<< HEAD
    async createCompany(userId: string, tenantId: string, properties: Record<string, any>) {
        const token = await this.getValidToken(userId, tenantId);
=======
    async createCompany(userId: string, properties: Record<string, any>) {
        const token = await this.getValidToken(userId);
>>>>>>> origin/main
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

<<<<<<< HEAD
    async updateCompany(userId: string, tenantId: string, companyId: string, properties: Record<string, any>) {
        const token = await this.getValidToken(userId, tenantId);
=======
    async updateCompany(userId: string, companyId: string, properties: Record<string, any>) {
        const token = await this.getValidToken(userId);
>>>>>>> origin/main
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

<<<<<<< HEAD
    async syncCompanyToHubSpot(userId: string, tenantId: string, company: any) {
=======
    async syncCompanyToHubSpot(userId: string, company: any) {
>>>>>>> origin/main
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

<<<<<<< HEAD
            const existing = await this.findCompany(userId, tenantId, { website: company.website, name: properties.name });
            if (existing?.id) {
                const updated = await this.updateCompany(userId, tenantId, existing.id, properties);
                return { success: true, data: updated, message: 'Company updated' };
            }

            const created = await this.createCompany(userId, tenantId, properties);
=======
            const existing = await this.findCompany(userId, { website: company.website, name: properties.name });
            if (existing?.id) {
                const updated = await this.updateCompany(userId, existing.id, properties);
                return { success: true, data: updated, message: 'Company updated' };
            }

            const created = await this.createCompany(userId, properties);
>>>>>>> origin/main
            return { success: true, data: created, message: 'Company created' };
        } catch (error) {
            console.error('HubSpot Sync Company Error:', error);
            throw error;
        }
    },

<<<<<<< HEAD
    /**
     * Create or update deal in HubSpot
     */
    async syncDealToHubSpot(userId: string, tenantId: string, deal: any) {
        try {
            const token = await this.getValidToken(userId, tenantId);
            const dealName = String(deal?.name || deal?.title || 'AlphaClone Deal').trim();
            const amount = Number(deal?.value ?? deal?.amount ?? 0) || 0;
            const stage = String(deal?.stage || 'appointmentscheduled');
            const closeDate = deal?.expectedCloseDate || deal?.expected_close_date;

            const properties: Record<string, string> = {
                dealname: dealName,
                amount: String(amount),
                dealstage: stage,
            };
            if (closeDate) {
                properties.closedate = new Date(closeDate).toISOString().split('T')[0];
            }

            const response = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ properties }),
            });

            const data = await response.json();
            if (response.ok) {
                return { success: true, data };
            }

            if (response.status === 409 && data?.id) {
                const updated = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${data.id}`, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ properties }),
                });
                const patchData = await updated.json();
                if (!updated.ok) throw new Error(patchData.message || 'Failed to update deal');
                return { success: true, data: patchData, message: 'Deal updated' };
            }

            if (!response.ok) throw new Error(data.message || 'Failed to sync deal');
            return { success: true, data };
        } catch (error) {
            console.error('HubSpot Sync Deal Error:', error);
            throw error;
        }
    },

=======
>>>>>>> origin/main
    /**
     * Delete contact from HubSpot
     */
    async deleteContact(userId: string, tenantId: string, contactId: string) {
        try {
            const token = await this.getValidToken(userId, tenantId);
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
