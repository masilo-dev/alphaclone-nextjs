import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { fileUploadService } from './fileUploadService';

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
    isVerified?: boolean;
    trustScore?: number;
    verificationNotes?: string;
    lat?: number;
    lng?: number;
    isAddressValid?: boolean;
    sdrInsight?: string;
}

export interface GrowthAgentTarget {
    id: string;
    tenant_id: string;
    name: string;
    industry?: string;
    location?: string;
    filters?: string;
    automated_outreach: boolean;
    last_run_at?: string;
    created_at: string;
    updated_at: string;
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
                client_id: l.client_id,
                isVerified: l.is_verified,
                trustScore: l.trust_score,
                verificationNotes: l.verification_notes,
                lat: l.latitude,
                lng: l.longitude,
                status: l.stage === 'lead' ? 'New' : l.stage,
                fb: l.website,
                sdrInsight: l.sdr_insight
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
            const { data: userData, error: authError } = await supabase.auth.getUser();

            if (authError || !userData.user) {
                const { data: refreshData } = await supabase.auth.refreshSession();
                if (!refreshData.user) {
                    return { lead: null, error: 'Authentication session expired. Please refresh the page.' };
                }
            }

            const dbPayload = {
                tenant_id: tenantId,
                owner_id: userData.user?.id || (await supabase.auth.getUser()).data.user?.id,
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
                outreach_status: lead.outreachStatus || 'pending',
                is_verified: lead.isVerified || false,
                trust_score: lead.trustScore || 0,
                verification_notes: lead.verificationNotes,
                latitude: lead.lat,
                longitude: lead.lng,
                sdr_insight: lead.sdrInsight
            };

            const { data, error } = await supabase
                .from('leads')
                .insert(dbPayload)
                .select()
                .single();

            if (error) {
                console.error('LeadService: Insert error', error);
                if (error.code === '42501') return { lead: null, error: 'Permission denied. Please refresh.' };
                throw error;
            }

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
                outreachStatus: data.outreach_status,
                isVerified: data.is_verified,
                trustScore: data.trust_score,
                verificationNotes: data.verification_notes,
                sdrInsight: data.sdr_insight
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
            const { data: userData, error: authError } = await supabase.auth.getUser();

            if (authError || !userData.user) {
                const { data: refreshData } = await supabase.auth.refreshSession();
                if (!refreshData.user) {
                    return { count: 0, error: 'Authentication session expired. Please refresh the page.' };
                }
            }

            const ownerId = userData.user?.id || (await supabase.auth.getUser()).data.user?.id;

            const dbPayloads = leads.map((l: any) => ({
                tenant_id: tenantId,
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
                outreach_status: l.outreachStatus || 'pending',
                is_verified: l.isVerified || false,
                trust_score: l.trustScore || 0,
                latitude: l.lat,
                longitude: l.lng,
                sdr_insight: l.sdrInsight
            }));

            const { data, error } = await supabase
                .from('leads')
                .insert(dbPayloads)
                .select();

            if (error) {
                console.error('LeadService: Bulk insert error', error);
                throw error;
            }

            return { count: data?.length || 0, error: null };
        } catch (err) {
            console.error('LeadService: Bulk insert exception', err);
            return { count: 0, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update a lead
     */
    async updateLead(id: string, updates: Partial<Lead>): Promise<{ error: string | null }> {
        const tenantId = this.getTenantId();

        if (updates.stage) {
            const { data: existingLead } = await supabase
                .from('leads')
                .select('stage')
                .eq('id', id)
                .eq('tenant_id', tenantId)
                .single();

            if (existingLead) {
                const stageOrder = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
                const currentIdx = stageOrder.indexOf(existingLead.stage);
                const newIdx = stageOrder.indexOf(updates.stage);

                if (newIdx < currentIdx && updates.stage !== 'lost') {
                    return { error: 'Cannot move lead back to a previous stage' };
                }
            }
        }

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
        if (updates.isVerified !== undefined) dbPayload.is_verified = updates.isVerified;
        if (updates.trustScore !== undefined) dbPayload.trust_score = updates.trustScore;
        if (updates.verificationNotes !== undefined) dbPayload.verification_notes = updates.verificationNotes;
        if (updates.sdrInsight !== undefined) dbPayload.sdr_insight = updates.sdrInsight;

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
                .eq('tenant_id', tenantId)
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
                status: data.stage === 'lead' ? 'New' : data.stage,
                fb: data.website,
                outreachMessage: data.outreach_message,
                outreachStatus: data.outreach_status,
                isVerified: data.is_verified,
                trustScore: data.trust_score,
                verificationNotes: data.verification_notes,
                sdrInsight: data.sdr_insight
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
        await fileUploadService.deleteFileByEntity('lead', id);
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantId);
        return { error: error ? error.message : null };
    },

    /**
     * Check if the tenant has reached the lead generation limit
     * Limit: 30 leads per 24-hour window for Free users
     */
    async checkLeadLimit(userRole?: string): Promise<{ allowed: boolean; error: string | null; remaining: number }> {
        try {
            // Super Admin bypass
            if (userRole === 'admin') {
                return { allowed: true, error: null, remaining: 9999 };
            }

            const tenantId = this.getTenantId();
            const { data: tenant, error: tenantError } = await supabase
                .from('tenants')
                .select('subscription_plan')
                .eq('id', tenantId)
                .single();

            if (tenantError) throw tenantError;

            if (tenant.subscription_plan === 'free') {
                const MAX_LEADS_24H = 30;
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

                const { count, error } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .gte('created_at', twentyFourHoursAgo);

                if (error) throw error;

                const currentCount = count || 0;
                const remaining = Math.max(0, MAX_LEADS_24H - currentCount);

                if (currentCount >= MAX_LEADS_24H) {
                    return {
                        allowed: false,
                        error: `Free plan limit reached: ${MAX_LEADS_24H} leads per 24 hours. Upgrade for unlimited lead generation.`,
                        remaining: 0
                    };
                }
                return { allowed: true, error: null, remaining };
            }

            return { allowed: true, error: null, remaining: 999 };
        } catch (error) {
            console.error('Error checking lead limit:', error);
            return { allowed: false, error: 'Failed to verify usage limits. Please try again.', remaining: 0 };
        }
    },

    /**
     * Get activity history for a lead
     */
    async getLeadActivities(leadId: string): Promise<{ activities: any[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('lead_activities')
                .select('*')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { activities: data || [], error: null };
        } catch (err: any) {
            console.error('Error fetching lead activities:', err);
            return { activities: [], error: err.message };
        }
    },

    /**
     * Add a manual activity/note to a lead
     */
    async addLeadActivity(leadId: string, userId: string, type: string, description: string, metadata: any = {}): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('lead_activities')
                .insert({
                    lead_id: leadId,
                    user_id: userId,
                    type,
                    description,
                    metadata
                });

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error adding lead activity:', err);
            return { error: err.message };
        }
    },

    /**
     * Enrich a lead with AI-powered business intelligence
     */
    async enrichLead(id: string, userId: string): Promise<{ notes: string | null; error: string | null }> {
        try {
            const { data: lead, error: getError } = await supabase
                .from('leads')
                .select('*')
                .eq('id', id)
                .single();
            if (getError || !lead) throw new Error(getError?.message || 'Lead not found');

            // Use the unified AI service for deep business research
            const { enrichLeadData } = await import('./unifiedAIService');
            const intelligence = await enrichLeadData({
                businessName: lead.business_name || lead.name,
                industry: lead.industry,
                location: lead.location || lead.city,
                website: lead.website
            });

            const { error: updateError } = await supabase
                .from('leads')
                .update({ notes: intelligence })
                .eq('id', id);
            if (updateError) throw updateError;

            await this.addLeadActivity(id, userId, 'enrichment', 'AI Intelligence Gathering Completed');

            return { notes: intelligence, error: null };
        } catch (err: any) {
            console.error('Error enriching lead:', err);
            return { notes: null, error: err.message };
        }
    },

    /**
     * Get all target criteria for the Growth Agent
     */
    async getGrowthAgentTargets(): Promise<{ targets: GrowthAgentTarget[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('growth_agent_targets')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { targets: data || [], error: null };
        } catch (err: any) {
            console.error('Error fetching growth agent targets:', err);
            return { targets: [], error: err.message };
        }
    },

    /**
     * Define new target criteria for the Growth Agent
     */
    async createGrowthAgentTarget(target: Partial<GrowthAgentTarget>): Promise<{ target: GrowthAgentTarget | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('growth_agent_targets')
                .insert({
                    tenant_id: tenantId,
                    name: target.name,
                    industry: target.industry,
                    location: target.location,
                    filters: target.filters,
                    automated_outreach: target.automated_outreach || false
                })
                .select()
                .single();

            if (error) throw error;
            return { target: data, error: null };
        } catch (err: any) {
            console.error('Error creating growth agent target:', err);
            return { target: null, error: err.message };
        }
    },

    /**
     * Update existing target criteria
     */
    async updateGrowthAgentTarget(id: string, updates: Partial<GrowthAgentTarget>): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { error } = await supabase
                .from('growth_agent_targets')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error updating growth agent target:', err);
            return { error: err.message };
        }
    },

    /**
     * Remove target criteria
     */
    async deleteGrowthAgentTarget(id: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { error } = await supabase
                .from('growth_agent_targets')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error deleting growth agent target:', err);
            return { error: err.message };
        }
    }
};
