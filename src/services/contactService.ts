import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { getUnifiedContacts, type UnifiedContact } from '../lib/crm/unifiedContacts';

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
        page?: number;
        limit?: number;
        sort?: 'created_at' | 'name';
        direction?: 'asc' | 'desc';
    }): Promise<{ contacts: ContactWithCompany[]; error: string | null; pagination?: { page: number; limit: number; total: number; pages: number } }> {
        try {
            const tenantId = this.getTenantId();

            const params = new URLSearchParams();
            if (filters?.search) params.set('search', filters.search);
            if (filters?.status) params.set('status', filters.status);
            if (filters?.page) params.set('page', String(filters.page));
            if (filters?.limit) params.set('limit', String(filters.limit));
            if (filters?.sort) params.set('sort', filters.sort);
            if (filters?.direction) params.set('direction', filters.direction);

            const url = `/api/tenant/${encodeURIComponent(tenantId)}/contacts${params.toString() ? `?${params.toString()}` : ''}`;
            const response = await fetch(url, { credentials: 'include' });
            const payload = await response.json().catch(() => ({}));

            if (response.ok && Array.isArray(payload.contacts)) {
                return {
                    contacts: (payload.contacts || []).map(this.mapContact),
                    error: null,
                    pagination: payload.pagination || undefined,
                };
            }

            let query = supabase
                .from('contacts')
                .select(`
                    *,
                    company:companies(id, name, industry, website)
                `)
                .eq('tenant_id', tenantId)
                .is('deleted_at', null);

            if (filters?.companyId) query = query.eq('company_id', filters.companyId);
            if (filters?.ownerId) query = query.eq('owner_id', filters.ownerId);
            if (filters?.status) query = query.eq('status', filters.status);
            if (filters?.search) {
                query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            return { contacts: (data || []).map(this.mapContact), error: null };
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
            const response = await fetch(`/api/tenant/${tenantId}/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contact) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.contact) throw new Error(payload.error || 'Contact could not be created');
            return { contact: this.mapContact(payload.contact), error: null };
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
            const response = await fetch(`/api/tenant/${tenantId}/contacts`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId, ...updates }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.contact) throw new Error(payload.error || 'Contact could not be updated');
            return { contact: this.mapContact(payload.contact), error: null };
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
            const response = await fetch(`/api/tenant/${tenantId}/contacts`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [contactId] }) });
            const payload = await response.json().catch(() => ({}));
            return { error: response.ok ? null : payload.error || 'Contact could not be deleted' };
        } catch (err: any) {
            console.error('Error deleting contact:', err);
            return { error: err.message };
        }
    },

    async restoreContact(contactId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const response = await fetch('/api/data/deleted-records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, action: 'restore', type: 'contact', id: contactId }) });
            const payload = await response.json().catch(() => ({}));
            return { error: response.ok ? null : payload.error || 'Contact could not be restored' };
        } catch (err: any) {
            return { error: err.message };
        }
    },

    async purgeContact(contactId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const response = await fetch('/api/data/deleted-records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, action: 'purge', type: 'contact', id: contactId }) });
            const payload = await response.json().catch(() => ({}));
            return { error: response.ok ? null : payload.error || 'Contact could not be permanently deleted' };
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
            const uniqueIds = [...new Set(contactIds)];
            const response = await fetch(`/api/tenant/${tenantId}/contacts`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: uniqueIds }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Contacts could not be deleted');
            return { error: null, count: Number(payload.count || 0) };
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

<<<<<<< HEAD
            const payload =
                typeof data === 'string'
                    ? (JSON.parse(data) as { contact_id?: string; client_id?: string })
                    : (data as { contact_id?: string; client_id?: string } | null);

            return {
                contactId: payload?.contact_id || null,
                clientId: payload?.client_id || undefined,
                error: null,
=======
            // RPC now returns a JSONB object with contact_id and client_id
            return { 
                contactId: data?.contact_id || null, 
                clientId: data?.client_id || null,
                error: null 
>>>>>>> origin/main
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
                    name: contact.name,
                    email: contact.email,
                    phone: contact.phone,
                    industry: contact.industry,
                    location: contact.location || null,
                    salesStage: 'lead',
                    value: 0,
                    description: 'Imported from Outlook contacts',
                    customFields: { importSource: 'outlook' },
                }));

            const updates = contacts.filter((contact) => existingByEmail.has(contact.email));

            if (inserts.length > 0) {
                const response = await fetch(`/api/tenant/${tenantId}/clients`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clients: inserts }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || 'Outlook contacts could not be created');
            }

            const results = await Promise.all(updates.map(async (contact) => {
                const response = await fetch(`/api/tenant/${tenantId}/clients`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientId: existingByEmail.get(contact.email), name: contact.name, phone: contact.phone || null, industry: contact.industry || null, location: contact.location || null }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || `Outlook contact ${contact.email} could not be updated`);
                return true;
            }));

            return { processed: inserts.length + results.length, error: null };
        } catch (err) {
            console.error('bulkUpsertOutlookImports failed:', err);
            return {
                processed: 0,
                error: err instanceof Error ? err.message : 'Outlook sync failed',
            };
        }
    },
};
