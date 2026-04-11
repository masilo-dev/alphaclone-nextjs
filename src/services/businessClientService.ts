import { supabase } from '../lib/supabase';
import { quotaService } from './quotaService';
import { assertContactSalesStageTransition } from '../lib/stageProgression';
import { tenantService } from './tenancy/TenantService';

export interface BusinessClient {
    id: string;
    tenantId: string;
    name: string;
    email?: string;
    phone?: string;
    // company?: string; // Removed as it does not exist in schema. Name is the primary identifier.
    salesStage: 'lead' | 'prospect' | 'customer' | 'lost'; // Mapped from sales_stage
    value: number;
    description?: string; // Mapped from description (was notes)
    location?: string; // Mapped from location (was address)
    customFields?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    isActive: boolean; // Added
    industry?: string; // Added
    website?: string; // Added
}

export interface ClientsResponse {
    clients: BusinessClient[];
    count: number;
    error: string | null;
}

export const businessClientService = {
    /**
     * Get all clients for a tenant with pagination
     */
    async getClients(tenantId: string, page: number = 1, limit: number = 50, searchTerm: string = ''): Promise<ClientsResponse> {
        try {
            const offset = (page - 1) * limit;

            let query = supabase
                .from('business_clients')
                .select('*', { count: 'exact' })
                .eq('tenant_id', tenantId);

            if (searchTerm) {
                query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
            }

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            const clients = (data || []).map((c: any) => ({
                id: c.id,
                tenantId: c.tenant_id,
                name: c.name,
                email: c.email,
                phone: c.phone,
                salesStage: c.sales_stage,
                value: parseFloat(c.value || 0),
                description: c.description,
                location: c.location,
                customFields: c.custom_fields,
                createdAt: c.created_at,
                updatedAt: c.updated_at,
                isActive: c.is_active,
                industry: c.industry,
                website: c.website
            }));

            return { clients, count: count || 0, error: null };
        } catch (err: any) {
            console.error('Error fetching clients:', err);
            return { clients: [], count: 0, error: err.message };
        }
    },

    /**
     * Get a single client by ID
     */
    async getClient(clientId: string): Promise<{ client: BusinessClient | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_clients')
                .select('*')
                .eq('id', clientId)
                .single();

            if (error) throw error;

            const client: BusinessClient = {
                id: data.id,
                tenantId: data.tenant_id,
                name: data.name,
                email: data.email,
                phone: data.phone,
                salesStage: data.sales_stage,
                value: parseFloat(data.value || 0),
                description: data.description,
                location: data.location,
                customFields: data.custom_fields,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
                isActive: data.is_active,
                industry: data.industry,
                website: data.website
            };

            return { client, error: null };
        } catch (err: any) {
            console.error('Error fetching client details:', err);
            return { client: null, error: err.message };
        }
    },

    /**
     * Create a new client
     */
    async createClient(tenantId: string, client: Partial<BusinessClient>): Promise<{ client: BusinessClient | null; error: string | null }> {
        try {
            // Check quota for leads (new clients are considered leads)
            if (client.salesStage === 'lead') {
                const quotaCheck = await quotaService.checkQuota('leads', tenantId);
                if (!quotaCheck.allowed) {
                    return { client: null, error: quotaCheck.message };
                }
            }

            const { data, error } = await supabase
                .from('business_clients')
                .insert({
                    tenant_id: tenantId,
                    name: client.name,
                    email: client.email,
                    phone: client.phone,
                    industry: client.industry,
                    location: client.location,
                    sales_stage: client.salesStage || 'lead',
                    value: client.value || 0,
                    description: client.description,
                    custom_fields: client.customFields || {},
                    website: client.website,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;

            const newClient: BusinessClient = {
                id: data.id,
                tenantId: data.tenant_id,
                name: data.name,
                email: data.email,
                phone: data.phone,
                salesStage: data.sales_stage,
                value: parseFloat(data.value || 0),
                description: data.description,
                location: data.location,
                customFields: data.custom_fields,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
                isActive: data.is_active,
                industry: data.industry,
                website: data.website
            };

            // Increment quota usage for leads
            if (newClient.salesStage === 'lead') {
                const { success: quotaSuccess, error: quotaError } = await quotaService.incrementQuota('leads', tenantId);
                if (!quotaSuccess) {
                    console.warn('Failed to increment lead quota:', quotaError);
                }
                
                // 900% AUTOMATION: Trigger background outreach drafting
                // Non-blocking so consumer doesn't wait
                this.autoDraftOutreach(newClient.id).catch(e => console.error('Auto-draft background err:', e));
            }

            return { client: newClient, error: null };
        } catch (err: any) {
            console.error('Error creating client:', err);
            return { client: null, error: err.message };
        }
    },

    /**
     * 900% AUTOMATION: Auto-draft email outreach for a lead
     */
    async autoDraftOutreach(clientId: string) {
        try {
            const { data: lead, error } = await supabase
                .from('business_clients')
                .select('*')
                .eq('id', clientId)
                .single();

            if (error || !lead) return;

            // Generate draft using AI Core
            const { aiCore } = await import('./core/AICore');
            const draft = await aiCore.generateLeadOutreach({
                name: lead.name,
                industry: lead.industry,
                description: lead.description,
                website: lead.website
            });

            // Update lead with draft in custom_fields
            const newCustomFields = {
                ...(lead.custom_fields || {}),
                ai_outreach_draft: draft
            };

            await supabase
                .from('business_clients')
                .update({ custom_fields: newCustomFields })
                .eq('id', clientId);

            console.log(`[900% Automation] Auto-drafted outreach for lead: ${lead.name}`);
        } catch (err) {
            console.error('Auto-draft outreach failed:', err);
        }
    },

    /**
     * Get user signature for email
     */
    async getUserSignature(userId: string): Promise<string> {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('name, custom_fields')
                .eq('id', userId)
                .single();

            if (profile?.custom_fields?.signature) {
                return profile.custom_fields.signature;
            }

            // Default professional signature
            return `\n\nBest regards,\n${profile?.name || 'Managing Director'}\nAlphaClone Business OS`;
        } catch (err) {
            return `\n\nBest regards,\nAlphaClone Business OS`;
        }
    },

    /**
     * Update a client
     */
    async updateClient(clientId: string, updates: Partial<BusinessClient>): Promise<{ error: string | null }> {
        try {
            if (updates.salesStage !== undefined) {
                const tenantId = tenantService.getCurrentTenantId();
                let query = supabase.from('business_clients').select('sales_stage').eq('id', clientId);
                if (tenantId) {
                    query = query.eq('tenant_id', tenantId);
                }
                const { data: row } = await query.single();
                const fromStage = row?.sales_stage as string | undefined;
                const check = assertContactSalesStageTransition(fromStage, updates.salesStage);
                if (!check.ok) {
                    return { error: check.message };
                }
            }

            const updateData: Record<string, any> = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.email !== undefined) updateData.email = updates.email;
            if (updates.phone !== undefined) updateData.phone = updates.phone;
            if (updates.industry !== undefined) updateData.industry = updates.industry;
            if (updates.location !== undefined) updateData.location = updates.location;
            if (updates.salesStage !== undefined) updateData.sales_stage = updates.salesStage;
            if (updates.value !== undefined) updateData.value = updates.value;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.customFields !== undefined) updateData.custom_fields = updates.customFields;
            if (updates.website !== undefined) updateData.website = updates.website;
            if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

            updateData.updated_at = new Date().toISOString();

            const { error } = await supabase
                .from('business_clients')
                .update(updateData)
                .eq('id', clientId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error updating client:', err);
            return { error: err.message };
        }
    },

    /**
     * Delete a client
     */
    async deleteClient(clientId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('business_clients')
                .delete()
                .eq('id', clientId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error deleting client:', err);
            return { error: err.message };
        }
    },

    /**
     * Import clients from parsed data
     */
    async importClients(tenantId: string, clients: Partial<BusinessClient>[]): Promise<{ count: number; error: string | null }> {
        try {
            const insertData = clients.map((c: any) => ({
                tenant_id: tenantId,
                name: c.name || c.company, // Prioritize name, fallback to company if imported data has it
                email: c.email,
                phone: c.phone,
                sales_stage: c.salesStage || c.stage || 'lead',
                value: c.value || 0,
                description: c.description || c.notes,
                location: c.location || c.address,
                custom_fields: c.customFields || {},
                is_active: true
            }));

            const { data, error } = await supabase
                .from('business_clients')
                .insert(insertData)
                .select();

            if (error) throw error;

            return { count: data?.length || 0, error: null };
        } catch (err: any) {
            console.error('Error importing clients:', err);
            return { count: 0, error: err.message };
        }
    },

    /**
     * Get aggregated dashboard stats
     */
    async getDashboardStats(tenantId: string): Promise<{ stats: DashboardStats | null; error: string | null }> {
        try {
            // Query tables directly — avoids dependency on the missing RPC function
            const [
                { count: totalProjects },
                { count: totalClients },
                { count: totalLeads },
                { count: totalDeals },
                { data: invoiceData },
            ] = await Promise.all([
                supabase.from('projects').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
                supabase.from('business_clients').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
                supabase.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
                supabase.from('deals').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
                supabase.from('invoices').select('id, status, amount').eq('tenant_id', tenantId),
            ]);

            const invoices = invoiceData || [];
            const totalRevenue = Math.round(invoices
                .filter((i: any) => i.status === 'paid')
                .reduce((sum: number, i: any) => sum + (i.amount || 0), 0) * 100) / 100;
            const pendingInvoices = invoices.filter((i: any) => i.status === 'pending').length;

            const stats: DashboardStats = {
                totalRevenue,
                clientCount: totalClients || 0,
                activeProjects: totalProjects || 0,
                pendingInvoices,
                recentActivity: [],
                monthlyRevenue: [],
                pipeline: {}
            };

            return { stats, error: null };
        } catch (err: any) {
            console.error('Error fetching dashboard stats:', err?.message);
            return { stats: null, error: err?.message || 'Failed to load stats' };
        }
    }
};

export interface DashboardStats {
    totalRevenue: number;
    clientCount: number;
    activeProjects: number;
    pendingInvoices: number;
    recentActivity: Array<{
        type: string;
        title: string;
        date: string;
    }>;
    monthlyRevenue: Array<{
        month: string;
        amount: number;

    }>;
    pipeline: Record<string, number>;
}
