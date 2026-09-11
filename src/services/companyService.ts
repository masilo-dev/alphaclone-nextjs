import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface Company {
    id: string;
    tenantId: string;
    name: string;
    legalName?: string;
    website?: string;
    industry?: string;
    companySize?: 'startup' | 'small' | 'medium' | 'enterprise';
    annualRevenue?: number;
    phone?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    linkedinUrl?: string;
    facebookUrl?: string;
    twitterUrl?: string;
    taxId?: string;
    description?: string;
    notes?: string;
    stage: 'lead' | 'prospect' | 'customer' | 'partner' | 'inactive';
    source?: string;
    ownerId?: string;
    tags?: string[];
    customFields?: Record<string, any>;
    createdAt: string;
    createdBy?: string;
    updatedAt: string;
    updatedBy?: string;
    deletedAt?: string;
}

export interface CompanyWithContacts extends Company {
    contacts?: Array<{
        id: string;
        fullName: string;
        title?: string;
        email: string;
        phone?: string;
    }>;
    contactCount?: number;
}

export const companyService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    /**
     * Get all companies for tenant
     */
    async getCompanies(filters?: {
        stage?: string;
        ownerId?: string;
        industry?: string;
        search?: string;
    }): Promise<{ companies: CompanyWithContacts[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('companies')
                .select(`
                    *,
                    contacts(id, first_name, last_name, full_name, title, email, phone)
                `)
                .eq('tenant_id', tenantId)
                .is('deleted_at', null);

            // Apply filters
            if (filters?.stage) {
                query = query.eq('stage', filters.stage);
            }
            if (filters?.ownerId) {
                query = query.eq('owner_id', filters.ownerId);
            }
            if (filters?.industry) {
                query = query.eq('industry', filters.industry);
            }
            if (filters?.search) {
                query = query.or(`name.ilike.%${filters.search}%,industry.ilike.%${filters.search}%`);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            const companies = (data || []).map((company: any) => ({
                ...this.mapCompany(company),
                contacts: (company.contacts || []).map((c: any) => ({
                    id: c.id,
                    fullName: c.full_name,
                    title: c.title,
                    email: c.email,
                    phone: c.phone,
                })),
                contactCount: (company.contacts || []).length,
            }));

            return { companies, error: null };
        } catch (err: any) {
            console.error('Error fetching companies:', err);
            return { companies: [], error: err.message };
        }
    },

    /**
     * Get single company by ID
     */
    async getCompany(companyId: string): Promise<{ company: CompanyWithContacts | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('companies')
                .select(`
                    *,
                    contacts(id, first_name, last_name, full_name, title, email, phone)
                `)
                .eq('id', companyId)
                .eq('tenant_id', tenantId)
                .is('deleted_at', null)
                .single();

            if (error) throw error;

            if (!data) {
                return { company: null, error: null };
            }

            const company: CompanyWithContacts = {
                ...this.mapCompany(data),
                contacts: (data.contacts || []).map((c: any) => ({
                    id: c.id,
                    fullName: c.full_name,
                    title: c.title,
                    email: c.email,
                    phone: c.phone,
                })),
                contactCount: (data.contacts || []).length,
            };

            return { company, error: null };
        } catch (err: any) {
            console.error('Error fetching company:', err);
            return { company: null, error: err.message };
        }
    },

    /**
     * Create new company
     */
    async createCompany(company: Partial<Company>): Promise<{ company: Company | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('companies')
                .insert({
                    tenant_id: tenantId,
                    name: company.name,
                    legal_name: company.legalName,
                    website: company.website,
                    industry: company.industry,
                    company_size: company.companySize,
                    annual_revenue: company.annualRevenue,
                    phone: company.phone,
                    email: company.email,
                    address_line1: company.addressLine1,
                    address_line2: company.addressLine2,
                    city: company.city,
                    state: company.state,
                    postal_code: company.postalCode,
                    country: company.country,
                    linkedin_url: company.linkedinUrl,
                    facebook_url: company.facebookUrl,
                    twitter_url: company.twitterUrl,
                    tax_id: company.taxId,
                    description: company.description,
                    notes: company.notes,
                    stage: company.stage || 'lead',
                    source: company.source,
                    owner_id: company.ownerId,
                    tags: company.tags || [],
                    custom_fields: company.customFields || {},
                    created_by: userData.user?.id,
                })
                .select()
                .single();

            if (error) throw error;

            return { company: this.mapCompany(data), error: null };
        } catch (err: any) {
            console.error('Error creating company:', err);
            return { company: null, error: err.message };
        }
    },

    /**
     * Update company
     */
    async updateCompany(companyId: string, updates: Partial<Company>): Promise<{ company: Company | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            const updateData: any = {};

            // Map camelCase to snake_case
            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.legalName !== undefined) updateData.legal_name = updates.legalName;
            if (updates.website !== undefined) updateData.website = updates.website;
            if (updates.industry !== undefined) updateData.industry = updates.industry;
            if (updates.companySize !== undefined) updateData.company_size = updates.companySize;
            if (updates.annualRevenue !== undefined) updateData.annual_revenue = updates.annualRevenue;
            if (updates.phone !== undefined) updateData.phone = updates.phone;
            if (updates.email !== undefined) updateData.email = updates.email;
            if (updates.addressLine1 !== undefined) updateData.address_line1 = updates.addressLine1;
            if (updates.addressLine2 !== undefined) updateData.address_line2 = updates.addressLine2;
            if (updates.city !== undefined) updateData.city = updates.city;
            if (updates.state !== undefined) updateData.state = updates.state;
            if (updates.postalCode !== undefined) updateData.postal_code = updates.postalCode;
            if (updates.country !== undefined) updateData.country = updates.country;
            if (updates.linkedinUrl !== undefined) updateData.linkedin_url = updates.linkedinUrl;
            if (updates.facebookUrl !== undefined) updateData.facebook_url = updates.facebookUrl;
            if (updates.twitterUrl !== undefined) updateData.twitter_url = updates.twitterUrl;
            if (updates.taxId !== undefined) updateData.tax_id = updates.taxId;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.notes !== undefined) updateData.notes = updates.notes;
            if (updates.stage !== undefined) updateData.stage = updates.stage;
            if (updates.source !== undefined) updateData.source = updates.source;
            if (updates.ownerId !== undefined) updateData.owner_id = updates.ownerId;
            if (updates.tags !== undefined) updateData.tags = updates.tags;
            if (updates.customFields !== undefined) updateData.custom_fields = updates.customFields;

            updateData.updated_by = userData.user?.id;

            const { data, error } = await supabase
                .from('companies')
                .update(updateData)
                .eq('id', companyId)
                .eq('tenant_id', tenantId)
                .is('deleted_at', null)
                .select()
                .single();

            if (error) throw error;

            return { company: this.mapCompany(data), error: null };
        } catch (err: any) {
            console.error('Error updating company:', err);
            return { company: null, error: err.message };
        }
    },

    /**
     * Soft delete company
     */
    async deleteCompany(companyId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('companies')
                .update({
                    deleted_at: new Date().toISOString(),
                    updated_by: userData.user?.id,
                })
                .eq('id', companyId)
                .eq('tenant_id', tenantId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error deleting company:', err);
            return { error: err.message };
        }
    },

    /**
     * Search companies (full-text search)
     */
    async searchCompanies(query: string): Promise<{ companies: CompanyWithContacts[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('companies')
                .select(`
                    *,
                    contacts(id, first_name, last_name, full_name, title, email, phone)
                `)
                .eq('tenant_id', tenantId)
                .is('deleted_at', null)
                .textSearch('fts', query)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            const companies = (data || []).map((company: any) => ({
                ...this.mapCompany(company),
                contacts: (company.contacts || []).map((c: any) => ({
                    id: c.id,
                    fullName: c.full_name,
                    title: c.title,
                    email: c.email,
                    phone: c.phone,
                })),
                contactCount: (company.contacts || []).length,
            }));

            return { companies, error: null };
        } catch (err: any) {
            // Fallback to simple search if full-text search fails
            return this.getCompanies({ search: query });
        }
    },

    /**
     * Map database record to Company interface
     */
    mapCompany(data: any): Company {
        return {
            id: data.id,
            tenantId: data.tenant_id,
            name: data.name,
            legalName: data.legal_name,
            website: data.website,
            industry: data.industry,
            companySize: data.company_size,
            annualRevenue: data.annual_revenue ? parseFloat(data.annual_revenue) : undefined,
            phone: data.phone,
            email: data.email,
            addressLine1: data.address_line1,
            addressLine2: data.address_line2,
            city: data.city,
            state: data.state,
            postalCode: data.postal_code,
            country: data.country,
            linkedinUrl: data.linkedin_url,
            facebookUrl: data.facebook_url,
            twitterUrl: data.twitter_url,
            taxId: data.tax_id,
            description: data.description,
            notes: data.notes,
            stage: data.stage,
            source: data.source,
            ownerId: data.owner_id,
            tags: data.tags || [],
            customFields: data.custom_fields || {},
            createdAt: data.created_at,
            createdBy: data.created_by,
            updatedAt: data.updated_at,
            updatedBy: data.updated_by,
            deletedAt: data.deleted_at,
        };
    },
};
