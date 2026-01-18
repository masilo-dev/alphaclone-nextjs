import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface Lead {
    id: string;
    owner_id?: string;
    businessName: string; // mapped from business_name
    industry?: string;
    location?: string;
    phone?: string;
    email?: string;
    website?: string;
    source: string;
    stage: string;
    value?: number;
    notes?: string;
    status?: string; // legacy/UI status
    fb?: string; // extra field often in UI
    created_at?: string;
    outreachMessage?: string;
    outreachStatus?: string;
}

export const leadService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    /**
     * Get leads for the current user
     */
    async getLeads(): Promise<{ leads: Lead[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('tenant_id', tenantId) // ← TENANT FILTER
                .order('created_at', { ascending: false });

            if (error) throw error;

            const leads: Lead[] = (data || []).map(l => ({
                id: l.id,
                owner_id: l.owner_id,
                businessName: l.business_name,
                industry: l.industry,
                location: l.location,
                phone: l.phone,
                email: l.email,
                website: l.website,
                source: l.source,
                stage: l.stage,
                value: l.value,
                notes: l.notes,
                created_at: l.created_at,
                // UI compatibility
                status: l.stage === 'lead' ? 'New' : l.stage,
                fb: l.website // Map website to fb/social link for display if needed
            }));

            return { leads, error: null };
        } catch (err) {
            console.error('Error fetching leads:', err);
            return { leads: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Add a single lead
     */
    async addLead(lead: Partial<Lead>): Promise<{ lead: Lead | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            const dbPayload = {
                tenant_id: tenantId, // ← ASSIGN TO TENANT
                owner_id: userData.user?.id,
                business_name: lead.businessName,
                industry: lead.industry,
                location: lead.location,
                phone: lead.phone,
                email: lead.email,
                website: lead.website || lead.fb,
                source: lead.source || 'Manual',
                stage: lead.stage || 'lead',
                value: lead.value || 0,
                notes: lead.notes,
                outreach_message: lead.outreachMessage,
                outreach_status: lead.outreachStatus || 'pending'
            };

            const { data, error } = await supabase
                .from('leads')
                .insert(dbPayload)
                .select()
                .single();

            if (error) throw error;

            const newLead: Lead = {
                id: data.id,
                businessName: data.business_name,
                industry: data.industry,
                location: data.location,
                phone: data.phone,
                email: data.email,
                source: data.source,
                stage: data.stage,
                value: data.value,
                notes: data.notes,
                status: 'New',
                outreachMessage: data.outreach_message,
                outreachStatus: data.outreach_status
            };

            return { lead: newLead, error: null };
        } catch (err) {
            return { lead: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Add multiple leads (Bulk Import)
     */
    async addBulkLeads(leads: Partial<Lead>[]): Promise<{ count: number; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();
            const ownerId = userData.user?.id;

            const dbPayloads = leads.map(l => ({
                tenant_id: tenantId, // ← ASSIGN TO TENANT
                owner_id: ownerId,
                business_name: l.businessName,
                industry: l.industry,
                location: l.location,
                phone: l.phone,
                email: l.email,
                website: l.website,
                source: l.source || 'Bulk Upload',
                stage: 'lead',
                value: l.value || 0,
                notes: l.notes,
                outreach_message: l.outreachMessage,
                outreach_status: l.outreachStatus || 'pending'
            }));

            const { data, error } = await supabase
                .from('leads')
                .insert(dbPayloads)
                .select();

            if (error) throw error;

            return { count: data?.length || 0, error: null };
        } catch (err) {
            return { count: 0, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete a lead
     */
    async deleteLead(id: string): Promise<{ error: string | null }> {
        const tenantId = this.getTenantId();

        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantId); // ← VERIFY OWNERSHIP
        return { error: error ? error.message : null };
    }
};
