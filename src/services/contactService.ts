import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { getUnifiedContacts, type UnifiedContact } from '../lib/crm/unifiedContacts';
import {
    softDeleteContactById,
    restoreContactById,
    purgeContactById,
} from '../lib/crm/softDeleteContact';

export interface Contact {
    id: string;
    tenantId: string;
    companyId?: string;
    firstName: string;
    lastName: string;
    fullName: string;
    title?: string;
    department?: string;
    email: string;
    phone?: string;
    mobile?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    linkedinUrl?: string;
    facebookUrl?: string;
    twitterUrl?: string;
    bio?: string;
    notes?: string;
    status: 'active' | 'inactive' | 'unsubscribed' | 'bounced';
    leadSource?: string;
    ownerId?: string;
    originalLeadId?: string;
    convertedFromLeadAt?: string;
    emailOptIn: boolean;
    smsOptIn: boolean;
    preferredContactMethod: 'email' | 'phone' | 'sms' | 'any';
    tags?: string[];
    customFields?: Record<string, any>;
    createdAt: string;
    createdBy?: string;
    updatedAt: string;
    updatedBy?: string;
    deletedAt?: string;
}

export interface ContactWithCompany extends Contact {
    company?: {
        id: string;
        name: string;
        industry?: string;
        website?: string;
    };
}

export const contactService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    /**
     * Get all contacts for tenant
     */
    async getContacts(filters?: {
        companyId?: string;
        ownerId?: string;
        status?: string;
        search?: string;
    }): Promise<{ contacts: ContactWithCompany[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('contacts')
                .select(`
                    *,
                    company:companies(id, name, industry, website)
                `)
                .eq('tenant_id', tenantId)
                .is('deleted_at', null);

            // Apply filters
            if (filters?.companyId) {
                query = query.eq('company_id', filters.companyId);
            }
            if (filters?.ownerId) {
                query = query.eq('owner_id', filters.ownerId);
            }
            if (filters?.status) {
                query = query.eq('status', filters.status);
            }
            if (filters?.search) {
                query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            const contacts = (data || []).map(this.mapContact);

            return { contacts, error: null };
        } catch (err: any) {
            console.error('Error fetching contacts:', err);
            return { contacts: [], error: err.message };
        }
    },

    /**
     * Get single contact by ID
     */
    async getContact(contactId: string): Promise<{ contact: ContactWithCompany | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('contacts')
                .select(`
                    *,
                    company:companies(id, name, industry, website)
                `)
                .eq('id', contactId)
                .eq('tenant_id', tenantId)
                .is('deleted_at', null)
                .single();

            if (error) throw error;

            return { contact: data ? this.mapContact(data) : null, error: null };
        } catch (err: any) {
            console.error('Error fetching contact:', err);
            return { contact: null, error: err.message };
        }
    },

    /**
     * Create new contact
     */
    async createContact(contact: Partial<Contact>): Promise<{ contact: Contact | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('contacts')
                .insert({
                    tenant_id: tenantId,
                    company_id: contact.companyId,
                    first_name: contact.firstName,
                    last_name: contact.lastName,
                    title: contact.title,
                    department: contact.department,
                    email: contact.email,
                    phone: contact.phone,
                    mobile: contact.mobile,
                    address_line1: contact.addressLine1,
                    address_line2: contact.addressLine2,
                    city: contact.city,
                    state: contact.state,
                    postal_code: contact.postalCode,
                    country: contact.country,
                    linkedin_url: contact.linkedinUrl,
                    facebook_url: contact.facebookUrl,
                    twitter_url: contact.twitterUrl,
                    bio: contact.bio,
                    notes: contact.notes,
                    status: contact.status || 'active',
                    lead_source: contact.leadSource,
                    owner_id: contact.ownerId,
                    email_opt_in: contact.emailOptIn ?? true,
                    sms_opt_in: contact.smsOptIn ?? false,
                    preferred_contact_method: contact.preferredContactMethod || 'email',
                    tags: contact.tags || [],
                    custom_fields: contact.customFields || {},
                    created_by: userData.user?.id,
                })
                .select()
                .single();

            if (error) throw error;

            return { contact: this.mapContact(data), error: null };
        } catch (err: any) {
            console.error('Error creating contact:', err);
            return { contact: null, error: err.message };
        }
    },

    /**
     * Update contact
     */
    async updateContact(contactId: string, updates: Partial<Contact>): Promise<{ contact: Contact | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            const updateData: any = {};

            // Map camelCase to snake_case
            if (updates.companyId !== undefined) updateData.company_id = updates.companyId;
            if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
            if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
            if (updates.title !== undefined) updateData.title = updates.title;
            if (updates.department !== undefined) updateData.department = updates.department;
            if (updates.email !== undefined) updateData.email = updates.email;
            if (updates.phone !== undefined) updateData.phone = updates.phone;
            if (updates.mobile !== undefined) updateData.mobile = updates.mobile;
            if (updates.addressLine1 !== undefined) updateData.address_line1 = updates.addressLine1;
            if (updates.addressLine2 !== undefined) updateData.address_line2 = updates.addressLine2;
            if (updates.city !== undefined) updateData.city = updates.city;
            if (updates.state !== undefined) updateData.state = updates.state;
            if (updates.postalCode !== undefined) updateData.postal_code = updates.postalCode;
            if (updates.country !== undefined) updateData.country = updates.country;
            if (updates.linkedinUrl !== undefined) updateData.linkedin_url = updates.linkedinUrl;
            if (updates.facebookUrl !== undefined) updateData.facebook_url = updates.facebookUrl;
            if (updates.twitterUrl !== undefined) updateData.twitter_url = updates.twitterUrl;
            if (updates.bio !== undefined) updateData.bio = updates.bio;
            if (updates.notes !== undefined) updateData.notes = updates.notes;
            if (updates.status !== undefined) updateData.status = updates.status;
            if (updates.leadSource !== undefined) updateData.lead_source = updates.leadSource;
            if (updates.ownerId !== undefined) updateData.owner_id = updates.ownerId;
            if (updates.emailOptIn !== undefined) updateData.email_opt_in = updates.emailOptIn;
            if (updates.smsOptIn !== undefined) updateData.sms_opt_in = updates.smsOptIn;
            if (updates.preferredContactMethod !== undefined) updateData.preferred_contact_method = updates.preferredContactMethod;
            if (updates.tags !== undefined) updateData.tags = updates.tags;
            if (updates.customFields !== undefined) updateData.custom_fields = updates.customFields;

            updateData.updated_by = userData.user?.id;

            const { data, error } = await supabase
                .from('contacts')
                .update(updateData)
                .eq('id', contactId)
                .eq('tenant_id', tenantId)
                .is('deleted_at', null)
                .select()
                .single();

            if (error) throw error;

            return { contact: this.mapContact(data), error: null };
        } catch (err: any) {
            console.error('Error updating contact:', err);
            return { contact: null, error: err.message };
        }
    },

    /**
     * Soft delete contact
     */
    async deleteContact(contactId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();
            return softDeleteContactById(supabase, tenantId, contactId, userData.user?.id);
        } catch (err: any) {
            console.error('Error deleting contact:', err);
            return { error: err.message };
        }
    },

    async restoreContact(contactId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            return restoreContactById(supabase, tenantId, contactId);
        } catch (err: any) {
            return { error: err.message };
        }
    },

    async purgeContact(contactId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            return purgeContactById(supabase, tenantId, contactId);
        } catch (err: any) {
            return { error: err.message };
        }
    },

    async getDeletedContacts(): Promise<{ contacts: ContactWithCompany[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('contacts')
                .select(`*, company:companies(id, name, industry, website)`)
                .eq('tenant_id', tenantId)
                .not('deleted_at', 'is', null)
                .order('deleted_at', { ascending: false });

            if (error) throw error;
            return { contacts: (data || []).map((row: Record<string, unknown>) => this.mapContact(row)), error: null };
        } catch (err: any) {
            return { contacts: [], error: err.message };
        }
    },

    async bulkDeleteContacts(contactIds: string[]): Promise<{ error: string | null; count: number }> {
        if (!contactIds.length) return { error: null, count: 0 };
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();
            const uniqueIds = [...new Set(contactIds)];
            for (const id of uniqueIds) {
                const result = await softDeleteContactById(supabase, tenantId, id, userData.user?.id);
                if (result.error) throw new Error(result.error);
            }
            return { error: null, count: uniqueIds.length };
        } catch (err: any) {
            console.error('Error bulk deleting contacts:', err);
            return { error: err.message, count: 0 };
        }
    },

    /**
     * Convert lead to contact
     * Uses database function for atomic operation
     */
    async convertLeadToContact(
        leadId: string,
        options?: {
            createCompany?: boolean;
            companyName?: string;
            contactName?: string; // NEW PARAMETER
        }
    ): Promise<{ contactId: string | null; clientId?: string; error: string | null }> {
        try {
            const { data, error } = await supabase.rpc('convert_lead_to_contact', {
                lead_id: leadId,
                create_company: options?.createCompany || false,
                company_name: options?.companyName || null,
                contact_name_override: options?.contactName || null,
            });

            if (error) throw error;

            const payload =
                typeof data === 'string'
                    ? (JSON.parse(data) as { contact_id?: string; client_id?: string })
                    : (data as { contact_id?: string; client_id?: string } | null);

            return {
                contactId: payload?.contact_id || null,
                clientId: payload?.client_id || undefined,
                error: null,
            };
        } catch (err: any) {
            console.error('Error converting lead to contact:', JSON.stringify(err, null, 2), err);
            return { contactId: null, error: err.message || 'Unknown error occurred during conversion' };
        }
    },

    /**
     * Get contacts by company
     */
    async getContactsByCompany(companyId: string): Promise<{ contacts: ContactWithCompany[]; error: string | null }> {
        return this.getContacts({ companyId });
    },

    /**
     * Search contacts (full-text search)
     */
    async searchContacts(query: string): Promise<{ contacts: ContactWithCompany[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('contacts')
                .select(`
                    *,
                    company:companies(id, name, industry, website)
                `)
                .eq('tenant_id', tenantId)
                .is('deleted_at', null)
                .textSearch('fts', query)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            const contacts = (data || []).map(this.mapContact);

            return { contacts, error: null };
        } catch (err: any) {
            // Fallback to simple search if full-text search fails
            return this.getContacts({ search: query });
        }
    },

    /**
     * Map database record to Contact interface
     */
    mapContact(data: any): ContactWithCompany {
        return {
            id: data.id,
            tenantId: data.tenant_id,
            companyId: data.company_id,
            firstName: data.first_name,
            lastName: data.last_name,
            fullName: data.full_name || `${data.first_name} ${data.last_name}`,
            title: data.title,
            department: data.department,
            email: data.email,
            phone: data.phone,
            mobile: data.mobile,
            addressLine1: data.address_line1,
            addressLine2: data.address_line2,
            city: data.city,
            state: data.state,
            postalCode: data.postal_code,
            country: data.country,
            linkedinUrl: data.linkedin_url,
            facebookUrl: data.facebook_url,
            twitterUrl: data.twitter_url,
            bio: data.bio,
            notes: data.notes,
            status: data.status,
            leadSource: data.lead_source,
            ownerId: data.owner_id,
            originalLeadId: data.original_lead_id,
            convertedFromLeadAt: data.converted_from_lead_at,
            emailOptIn: data.email_opt_in,
            smsOptIn: data.sms_opt_in,
            preferredContactMethod: data.preferred_contact_method,
            tags: data.tags || [],
            customFields: data.custom_fields || {},
            createdAt: data.created_at,
            createdBy: data.created_by,
            updatedAt: data.updated_at,
            updatedBy: data.updated_by,
            deletedAt: data.deleted_at,
            company: data.company,
        };
    },

    /**
     * Merged contacts + business_clients without a contacts row (canonical CRM read path).
     */
    async getUnifiedContactsList(options?: {
        limit?: number;
        search?: string;
        status?: string;
    }): Promise<{ contacts: UnifiedContact[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const contacts = await getUnifiedContacts(supabase, tenantId, options);
            return { contacts, error: null };
        } catch (err) {
            console.error('Error fetching unified contacts:', err);
            return {
                contacts: [],
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    },

    async bulkUpsertOutlookImports(
        tenantId: string,
        contacts: Array<{
            name: string;
            email: string;
            phone?: string;
            industry?: string;
            location?: string | null;
        }>
    ): Promise<{ processed: number; error: string | null }> {
        try {
            const emails = contacts.map((c) => c.email).filter(Boolean);
            if (emails.length === 0) {
                return { processed: 0, error: null };
            }

            const { data: existingClients, error: existingError } = await supabase
                .from('business_clients')
                .select('id, email')
                .eq('tenant_id', tenantId)
                .in('email', emails);

            if (existingError) throw existingError;

            const existingByEmail = new Map(
                ((existingClients as Array<{ id: string; email: string }>) || []).map((client) => [client.email, client.id])
            );

            const inserts = contacts
                .filter((contact) => !existingByEmail.has(contact.email))
                .map((contact) => ({
                    tenant_id: tenantId,
                    name: contact.name,
                    email: contact.email,
                    phone: contact.phone,
                    industry: contact.industry,
                    location: contact.location || null,
                    sales_stage: 'lead',
                    value: 0,
                    is_active: true,
                    description: 'Imported from Outlook contacts',
                }));

            const updates = contacts.filter((contact) => existingByEmail.has(contact.email));

            if (inserts.length > 0) {
                const { error: insertError } = await supabase.from('business_clients').insert(inserts);
                if (insertError) throw insertError;
            }

            await Promise.all(
                updates.map((contact) =>
                    supabase
                        .from('business_clients')
                        .update({
                            name: contact.name,
                            phone: contact.phone,
                            industry: contact.industry,
                            location: contact.location || null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', existingByEmail.get(contact.email)!)
                        .eq('tenant_id', tenantId)
                )
            );

            return { processed: contacts.length, error: null };
        } catch (err) {
            console.error('bulkUpsertOutlookImports failed:', err);
            return {
                processed: 0,
                error: err instanceof Error ? err.message : 'Outlook sync failed',
            };
        }
    },
};
