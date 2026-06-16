import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface Campaign {
    id: string;
    tenant_id: string;
    name: string;
    subject: string;
    template_id?: string;
    from_name: string;
    from_email: string;
    status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled';
    scheduled_at?: string;
    segment_filter?: Record<string, any>;
    total_recipients: number;
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_bounced: number;
    total_unsubscribed: number;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface CampaignRecipient {
    id: string;
    campaign_id: string;
    contact_id?: string;
    email: string;
    name?: string;
    status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed' | 'failed';
    sent_at?: string;
    delivered_at?: string;
    opened_at?: string;
    clicked_at?: string;
    error_message?: string;
}

export interface CampaignTemplate {
    id: string;
    tenant_id: string;
    name: string;
    subject: string;
    html_content: string;
    plain_text?: string;
    variables?: string[];
    created_at: string;
    updated_at: string;
}

export const campaignService = {
    /**
     * Get all campaigns for tenant
     */
    async getCampaigns(): Promise<{ campaigns: Campaign[]; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { campaigns: [], error: 'No tenant context' };

            const { data, error } = await supabase
                .from('email_campaigns')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { campaigns: data || [], error: null };
        } catch (err: any) {
            return { campaigns: [], error: err.message };
        }
    },

    /**
     * Get single campaign by ID
     */
    async getCampaign(id: string): Promise<{ campaign: Campaign | null; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { campaign: null, error: 'No tenant context' };

            const { data, error } = await supabase
                .from('email_campaigns')
                .select('*')
                .eq('id', id)
                .eq('tenant_id', tenantId)
                .single();

            if (error) throw error;
            return { campaign: data, error: null };
        } catch (err: any) {
            return { campaign: null, error: err.message };
        }
    },

    /**
     * Create a new campaign
     */
    async createCampaign(campaign: {
        name: string;
        subject?: string;
        body?: string;
        type?: string;
        status?: string;
        from_name?: string;
        from_email?: string;
        tenantId?: string;
        template_id?: string;
        scheduled_at?: string;
        segment_filter?: Record<string, any>;
    }): Promise<{ campaign: Campaign | null; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { campaign: null, error: 'No tenant context' };

            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) return { campaign: null, error: 'Not authenticated' };

            const { data, error } = await supabase
                .from('email_campaigns')
                .insert({
                    tenant_id: tenantId,
                    name: campaign.name,
                    subject: campaign.subject,
                    from_name: campaign.from_name,
                    from_email: campaign.from_email,
                    template_id: campaign.template_id,
                    scheduled_at: campaign.scheduled_at,
                    segment_filter: campaign.segment_filter || {},
                    status: campaign.scheduled_at ? 'scheduled' : 'draft',
                    created_by: userData.user.id,
                    total_recipients: 0,
                    total_sent: 0,
                    total_delivered: 0,
                    total_opened: 0,
                    total_clicked: 0,
                    total_bounced: 0,
                    total_unsubscribed: 0,
                })
                .select()
                .single();

            if (error) throw error;
            return { campaign: data, error: null };
        } catch (err: any) {
            return { campaign: null, error: err.message };
        }
    },

    /**
     * Update campaign
     */
    async updateCampaign(id: string, updates: Partial<Campaign>): Promise<{ error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { error: 'No tenant context' };

            const { error } = await supabase
                .from('email_campaigns')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    },

    /**
     * Delete campaign
     */
    async deleteCampaign(id: string): Promise<{ error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { error: 'No tenant context' };

            const { error } = await supabase
                .from('email_campaigns')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    },

    /**
     * Send campaign immediately
     */
    async sendCampaign(id: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { success: false, error: 'No tenant context' };

            const { data: campaign, error: fetchError } = await supabase
                .from('email_campaigns')
                .select('*')
                .eq('id', id)
                .eq('tenant_id', tenantId)
                .single();

            if (fetchError || !campaign) return { success: false, error: 'Campaign not found' };

            // Update status to sending
            await supabase
                .from('email_campaigns')
                .update({ status: 'sending', updated_at: new Date().toISOString() })
                .eq('id', id);

            // Trigger async send via API
            const res = await fetch('/api/campaigns/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId: id, tenantId }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Send failed');

            return { success: true, error: null };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    },

    /**
     * Get campaign recipients
     */
    async getRecipients(campaignId: string): Promise<{ recipients: CampaignRecipient[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('campaign_recipients')
                .select('*')
                .eq('campaign_id', campaignId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { recipients: data || [], error: null };
        } catch (err: any) {
            return { recipients: [], error: err.message };
        }
    },

    /**
     * Get campaign templates
     */
    async getTemplates(): Promise<{ templates: CampaignTemplate[]; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { templates: [], error: 'No tenant context' };

            const { data, error } = await supabase
                .from('email_templates')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { templates: data || [], error: null };
        } catch (err: any) {
            return { templates: [], error: err.message };
        }
    },

    /**
     * Create campaign template
     */
    async createTemplate(template: {
        name: string;
        subject: string;
        html_content: string;
        plain_text?: string;
        variables?: string[];
    }): Promise<{ template: CampaignTemplate | null; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { template: null, error: 'No tenant context' };

            const { data, error } = await supabase
                .from('email_templates')
                .insert({
                    tenant_id: tenantId,
                    name: template.name,
                    subject: template.subject,
                    html_content: template.html_content,
                    plain_text: template.plain_text,
                    variables: template.variables || [],
                })
                .select()
                .single();

            if (error) throw error;
            return { template: data, error: null };
        } catch (err: any) {
            return { template: null, error: err.message };
        }
    },

    /**
     * Delete template
     */
    async deleteTemplate(id: string): Promise<{ error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { error: 'No tenant context' };

            const { error } = await supabase
                .from('email_templates')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    },

    /**
     * Get campaign analytics summary
     */
    async getAnalytics(campaignId: string): Promise<{
        analytics: {
            total: number;
            sent: number;
            delivered: number;
            opened: number;
            clicked: number;
            bounced: number;
            unsubscribed: number;
            openRate: number;
            clickRate: number;
            deliveryRate: number;
        } | null;
        error: string | null;
    }> {
        try {
            const { data: recipients, error } = await supabase
                .from('campaign_recipients')
                .select('status')
                .eq('campaign_id', campaignId);

            if (error) throw error;

            const total = recipients?.length || 0;
            const sent = recipients?.filter((r: { status: string }) => r.status !== 'pending').length || 0;
            const delivered = recipients?.filter((r: { status: string }) => r.status === 'delivered' || r.status === 'opened' || r.status === 'clicked').length || 0;
            const opened = recipients?.filter((r: { status: string }) => r.status === 'opened' || r.status === 'clicked').length || 0;
            const clicked = recipients?.filter((r: { status: string }) => r.status === 'clicked').length || 0;
            const bounced = recipients?.filter((r: { status: string }) => r.status === 'bounced').length || 0;
            const unsubscribed = recipients?.filter((r: { status: string }) => r.status === 'unsubscribed').length || 0;

            return {
                analytics: {
                    total,
                    sent,
                    delivered,
                    opened,
                    clicked,
                    bounced,
                    unsubscribed,
                    openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
                    clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
                    deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
                },
                error: null,
            };
        } catch (err: any) {
            return { analytics: null, error: err.message };
        }
    },
};
