import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';
export type RecipientStatus = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed' | 'failed';

export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    category?: string;
    variables?: string[];
    thumbnailUrl?: string;
    createdBy?: string;
    isSystem: boolean;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
}

export interface EmailCampaign {
    id: string;
    name: string;
    subject: string;
    templateId?: string;
    fromName: string;
    fromEmail: string;
    replyTo?: string;
    status: CampaignStatus;
    scheduledAt?: string;
    sentAt?: string;
    completedAt?: string;
    segmentFilter?: any;
    totalRecipients: number;
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    totalUnsubscribed: number;
    createdBy?: string;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
}

export interface CampaignRecipient {
    id: string;
    campaignId: string;
    contactId: string;
    email: string;
    status: RecipientStatus;
    sentAt?: string;
    deliveredAt?: string;
    openedAt?: string;
    firstOpenedAt?: string;
    openCount: number;
    clickedAt?: string;
    clickCount: number;
    bouncedAt?: string;
    bounceReason?: string;
    unsubscribedAt?: string;
    errorMessage?: string;
    metadata?: any;
    createdAt: string;
}

export const emailCampaignService = {
    /**
     * Get all email templates
     */
    async getTemplates(category?: string): Promise<{ templates: EmailTemplate[]; error: string | null }> {
        try {
            let query = supabase.from('email_templates').select('*').eq('tenant_id', tenantService.getCurrentTenantId());

            if (category) {
                query = query.eq('category', category);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            const templates: EmailTemplate[] = (data || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                subject: t.subject,
                bodyHtml: t.body_html,
                bodyText: t.body_text,
                category: t.category,
                variables: t.variables || [],
                thumbnailUrl: t.thumbnail_url,
                createdBy: t.created_by,
                isSystem: t.is_system,
                metadata: t.metadata || {},
                createdAt: t.created_at,
                updatedAt: t.updated_at,
            }));

            return { templates, error: null };
        } catch (err) {
            return { templates: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Create email template
     */
    async createTemplate(
        userId: string,
        templateData: {
            name: string;
            subject: string;
            bodyHtml: string;
            bodyText?: string;
            category?: string;
            variables?: string[];
        }
    ): Promise<{ template: EmailTemplate | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('email_templates')
                .insert({
                    name: templateData.name,
                    subject: templateData.subject,
                    body_html: templateData.bodyHtml,
                    body_text: templateData.bodyText,
                    category: templateData.category,
                    variables: templateData.variables || [],
                    created_by: userId,
                    tenant_id: tenantService.getCurrentTenantId(),
                })
                .select()
                .single();

            if (error) throw error;

            const template: EmailTemplate = {
                id: data.id,
                name: data.name,
                subject: data.subject,
                bodyHtml: data.body_html,
                bodyText: data.body_text,
                category: data.category,
                variables: data.variables || [],
                thumbnailUrl: data.thumbnail_url,
                createdBy: data.created_by,
                isSystem: data.is_system,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { template, error: null };
        } catch (err) {
            return { template: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update email template
     */
    async updateTemplate(
        templateId: string,
        updates: Partial<EmailTemplate>
    ): Promise<{ template: EmailTemplate | null; error: string | null }> {
        try {
            const updateData: any = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.subject !== undefined) updateData.subject = updates.subject;
            if (updates.bodyHtml !== undefined) updateData.body_html = updates.bodyHtml;
            if (updates.bodyText !== undefined) updateData.body_text = updates.bodyText;
            if (updates.category !== undefined) updateData.category = updates.category;
            if (updates.variables !== undefined) updateData.variables = updates.variables;

            const { data, error } = await supabase
                .from('email_templates')
                .update(updateData)
                .eq('id', templateId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .select()
                .single();

            if (error) throw error;

            const template: EmailTemplate = {
                id: data.id,
                name: data.name,
                subject: data.subject,
                bodyHtml: data.body_html,
                bodyText: data.body_text,
                category: data.category,
                variables: data.variables || [],
                thumbnailUrl: data.thumbnail_url,
                createdBy: data.created_by,
                isSystem: data.is_system,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { template, error: null };
        } catch (err) {
            return { template: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete email template
     */
    async deleteTemplate(templateId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase.from('email_templates').delete().eq('id', templateId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .eq('is_system', false);

            if (error) throw error;

            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get all campaigns
     */
    async getCampaigns(limit?: number): Promise<{ campaigns: EmailCampaign[]; error: string | null }> {
        try {
            let query = supabase.from('email_campaigns')
                .select('*')
                .eq('tenant_id', tenantService.getCurrentTenantId());

            const { data, error } = await query.order('created_at', { ascending: false }).limit(limit || 100);

            if (error) throw error;

            const campaigns: EmailCampaign[] = (data || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                subject: c.subject,
                templateId: c.template_id,
                fromName: c.from_name,
                fromEmail: c.from_email,
                replyTo: c.reply_to,
                status: c.status,
                scheduledAt: c.scheduled_at,
                sentAt: c.sent_at,
                completedAt: c.completed_at,
                segmentFilter: c.segment_filter || {},
                totalRecipients: c.total_recipients,
                totalSent: c.total_sent,
                totalDelivered: c.total_delivered,
                totalOpened: c.total_opened,
                totalClicked: c.total_clicked,
                totalBounced: c.total_bounced,
                totalUnsubscribed: c.total_unsubscribed,
                createdBy: c.created_by,
                metadata: c.metadata || {},
                createdAt: c.created_at,
                updatedAt: c.updated_at,
            }));

            return { campaigns, error: null };
        } catch (err) {
            return { campaigns: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Create email campaign
     */
    async createCampaign(
        userId: string,
        campaignData: {
            name: string;
            subject: string;
            templateId?: string;
            fromName: string;
            fromEmail: string;
            replyTo?: string;
            scheduledAt?: string;
            segmentFilter?: any;
        }
    ): Promise<{ campaign: EmailCampaign | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('email_campaigns')
                .insert({
                    name: campaignData.name,
                    subject: campaignData.subject,
                    template_id: campaignData.templateId,
                    from_name: campaignData.fromName,
                    from_email: campaignData.fromEmail,
                    reply_to: campaignData.replyTo,
                    scheduled_at: campaignData.scheduledAt,
                    segment_filter: campaignData.segmentFilter || {},
                    created_by: userId,
                    tenant_id: tenantService.getCurrentTenantId(),
                })
                .select()
                .single();

            if (error) throw error;

            const campaign: EmailCampaign = {
                id: data.id,
                name: data.name,
                subject: data.subject,
                templateId: data.template_id,
                fromName: data.from_name,
                fromEmail: data.from_email,
                replyTo: data.reply_to,
                status: data.status,
                scheduledAt: data.scheduled_at,
                sentAt: data.sent_at,
                completedAt: data.completed_at,
                segmentFilter: data.segment_filter || {},
                totalRecipients: data.total_recipients,
                totalSent: data.total_sent,
                totalDelivered: data.total_delivered,
                totalOpened: data.total_opened,
                totalClicked: data.total_clicked,
                totalBounced: data.total_bounced,
                totalUnsubscribed: data.total_unsubscribed,
                createdBy: data.created_by,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { campaign, error: null };
        } catch (err) {
            return { campaign: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update campaign
     */
    async updateCampaign(
        campaignId: string,
        updates: Partial<EmailCampaign>
    ): Promise<{ campaign: EmailCampaign | null; error: string | null }> {
        try {
            const updateData: any = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.subject !== undefined) updateData.subject = updates.subject;
            if (updates.status !== undefined) updateData.status = updates.status;
            if (updates.scheduledAt !== undefined) updateData.scheduled_at = updates.scheduledAt;

            const { data, error } = await supabase
                .from('email_campaigns')
                .update(updateData)
                .eq('id', campaignId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .select()
                .single();

            if (error) throw error;

            const campaign: EmailCampaign = {
                id: data.id,
                name: data.name,
                subject: data.subject,
                templateId: data.template_id,
                fromName: data.from_name,
                fromEmail: data.from_email,
                replyTo: data.reply_to,
                status: data.status,
                scheduledAt: data.scheduled_at,
                sentAt: data.sent_at,
                completedAt: data.completed_at,
                segmentFilter: data.segment_filter || {},
                totalRecipients: data.total_recipients,
                totalSent: data.total_sent,
                totalDelivered: data.total_delivered,
                totalOpened: data.total_opened,
                totalClicked: data.total_clicked,
                totalBounced: data.total_bounced,
                totalUnsubscribed: data.total_unsubscribed,
                createdBy: data.created_by,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { campaign, error: null };
        } catch (err) {
            return { campaign: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete campaign
     */
    async deleteCampaign(campaignId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase
                .from('email_campaigns')
                .delete()
                .eq('id', campaignId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .in('status', ['draft', 'cancelled']);

            if (error) throw error;

            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get campaign recipients
     */
    async getCampaignRecipients(campaignId: string): Promise<{ recipients: CampaignRecipient[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('campaign_recipients')
                .select('*')
                .eq('campaign_id', campaignId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .order('created_at', { ascending: true });

            if (error) throw error;

            const recipients: CampaignRecipient[] = (data || []).map((r: any) => ({
                id: r.id,
                campaignId: r.campaign_id,
                contactId: r.contact_id,
                email: r.email,
                status: r.status,
                sentAt: r.sent_at,
                deliveredAt: r.delivered_at,
                openedAt: r.opened_at,
                firstOpenedAt: r.first_opened_at,
                openCount: r.open_count,
                clickedAt: r.clicked_at,
                clickCount: r.click_count,
                bouncedAt: r.bounced_at,
                bounceReason: r.bounce_reason,
                unsubscribedAt: r.unsubscribed_at,
                errorMessage: r.error_message,
                metadata: r.metadata || {},
                createdAt: r.created_at,
            }));

            return { recipients, error: null };
        } catch (err) {
            return { recipients: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get campaign analytics
     */
    async getCampaignAnalytics(campaignId: string): Promise<{
        analytics: {
            openRate: number;
            clickRate: number;
            bounceRate: number;
            unsubscribeRate: number;
        };
        error: string | null;
    }> {
        try {
            const { data, error } = await supabase
                .from('email_campaigns')
                .select('*')
                .eq('id', campaignId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .single();

            if (error) throw error;

            const total = data.total_sent || 0;

            const analytics = {
                openRate: total > 0 ? (data.total_opened / total) * 100 : 0,
                clickRate: total > 0 ? (data.total_clicked / total) * 100 : 0,
                bounceRate: total > 0 ? (data.total_bounced / total) * 100 : 0,
                unsubscribeRate: total > 0 ? (data.total_unsubscribed / total) * 100 : 0,
            };

            return { analytics, error: null };
        } catch (err) {
            return {
                analytics: { openRate: 0, clickRate: 0, bounceRate: 0, unsubscribeRate: 0 },
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    },
};
