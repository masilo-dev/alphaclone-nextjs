import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface Lead {
    id: string;
    owner_id?: string;
    client_id?: string; // Link to CRM client record
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

            const leads: Lead[] = (data || []).map((l: any) => ({
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

            // Trial limits removed - unlimited leads allowed
            /*
            // ENFORCE TRIAL LIMITS
            const { data: tenantData } = await supabase
                .from('tenants')
                .select('subscription_status')
                .eq('id', tenantId)
                .single();

            const isTrial = tenantData?.subscription_status === 'trial';

            if (isTrial) {
                const { TRIAL_LIMITS } = await import('./tenancy/types');

                // Check total limit
                const { count: totalCount } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId);

                if (totalCount && totalCount >= TRIAL_LIMITS.MAX_TOTAL_LEADS) {
                    return { lead: null, error: `Trial limit reached: You can only have a total of ${TRIAL_LIMITS.MAX_TOTAL_LEADS} leads during your trial. Please upgrade to unlock more.` };
                }

                // Check daily limit
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const { count: dailyCount } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .gte('created_at', today.toISOString());

                if (dailyCount && dailyCount >= TRIAL_LIMITS.MAX_LEADS_PER_DAY) {
                    return { lead: null, error: `Daily trial limit reached: You can only add ${TRIAL_LIMITS.MAX_LEADS_PER_DAY} leads per day during your trial. Please upgrade for unlimited daily leads.` };
                }
            }
            */

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

            // Trial limits removed - unlimited bulk leads allowed
            /*
            // ENFORCE TRIAL LIMITS
            const { data: tenantData } = await supabase
                .from('tenants')
                .select('subscription_status')
                .eq('id', tenantId)
                .single();

            const isTrial = tenantData?.subscription_status === 'trial';

            if (isTrial) {
                const { TRIAL_LIMITS } = await import('./tenancy/types');

                // Check total limit
                const { count: totalCount } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId);

                const remainingTotal = TRIAL_LIMITS.MAX_TOTAL_LEADS - (totalCount || 0);
                if (remainingTotal <= 0) {
                    return { count: 0, error: `Trial limit reached: You can only have a total of ${TRIAL_LIMITS.MAX_TOTAL_LEADS} leads during your trial.` };
                }

                // Check daily limit
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const { count: dailyCount } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .gte('created_at', today.toISOString());

                const remainingDaily = TRIAL_LIMITS.MAX_LEADS_PER_DAY - (dailyCount || 0);
                if (remainingDaily <= 0) {
                    return { count: 0, error: `Daily trial limit reached: You can only add ${TRIAL_LIMITS.MAX_LEADS_PER_DAY} leads per day during your trial.` };
                }

                // Cap the bulk import if it exceeds remaining trial limits
                const allowedLeadsCount = Math.min(remainingTotal, remainingDaily);
                if (leads.length > allowedLeadsCount) {
                    leads = leads.slice(0, allowedLeadsCount);
                }
            }
            */

            const { data: userData } = await supabase.auth.getUser();
            const ownerId = userData.user?.id;

            const dbPayloads = leads.map((l: any) => ({
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
     * Update a lead
     */
    async updateLead(id: string, updates: Partial<Lead>): Promise<{ error: string | null }> {
        const tenantId = this.getTenantId();

        const dbPayload: any = {};
        if (updates.businessName) dbPayload.business_name = updates.businessName;
        if (updates.industry !== undefined) dbPayload.industry = updates.industry;
        if (updates.location !== undefined) dbPayload.location = updates.location;
        if (updates.phone !== undefined) dbPayload.phone = updates.phone;
        if (updates.email !== undefined) dbPayload.email = updates.email;
        if (updates.website !== undefined) dbPayload.website = updates.website;
        if (updates.source !== undefined) dbPayload.source = updates.source;
        if (updates.stage !== undefined) dbPayload.stage = updates.stage;
        if (updates.value !== undefined) dbPayload.value = updates.value;
        if (updates.notes !== undefined) dbPayload.notes = updates.notes;
        if (updates.client_id !== undefined) dbPayload.client_id = updates.client_id;
        if (updates.outreachMessage !== undefined) dbPayload.outreach_message = updates.outreachMessage;
        if (updates.outreachStatus !== undefined) dbPayload.outreach_status = updates.outreachStatus;

        const { error } = await supabase
            .from('leads')
            .update(dbPayload)
            .eq('id', id)
            .eq('tenant_id', tenantId);

        return { error: error ? error.message : null };
    },

    /**
     * Get a single lead by ID
     */
    async getLeadById(id: string): Promise<{ lead: Lead | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('id', id)
                .eq('tenant_id', tenantId) // ← VERIFY OWNERSHIP
                .single();

            if (error) throw error;

            const lead: Lead = {
                id: data.id,
                owner_id: data.owner_id,
                businessName: data.business_name,
                industry: data.industry,
                location: data.location,
                phone: data.phone,
                email: data.email,
                website: data.website,
                source: data.source,
                stage: data.stage,
                value: data.value,
                notes: data.notes,
                created_at: data.created_at,
                // UI compatibility
                status: data.stage === 'lead' ? 'New' : data.stage,
                fb: data.website,
                outreachMessage: data.outreach_message,
                outreachStatus: data.outreach_status
            };

            return { lead, error: null };
        } catch (err) {
            return { lead: null, error: err instanceof Error ? err.message : 'Unknown error' };
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
