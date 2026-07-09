import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { emailProviderService } from './EmailProviderService';

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

export interface RecipientData {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    [key: string]: any;
}

export interface MarketingContact {
    id: string;
    name: string;
    email: string;
    company?: string;
    firstName?: string;
    lastName?: string;
    industry?: string;
}

type EmailTemplateRow = {
    id: string;
    name: string;
    subject: string;
    body_html: string;
    body_text: string | null;
    category: string | null;
    variables: unknown;
    thumbnail_url: string | null;
    created_by: string | null;
    is_system: boolean | null;
    metadata: unknown;
    created_at: string;
    updated_at: string;
    tenant_id: string | null;
};

function dedupeTemplatesByName(rows: EmailTemplateRow[], tenantId: string | null): EmailTemplateRow[] {
    const map = new Map<string, EmailTemplateRow>();
    for (const row of rows) {
        const existing = map.get(row.name);
        if (!existing) {
            map.set(row.name, row);
            continue;
        }
        const score = (r: EmailTemplateRow) =>
            tenantId && r.tenant_id === tenantId ? 2 : r.tenant_id === null ? 1 : 0;
        if (score(row) > score(existing)) {
            map.set(row.name, row);
        }
    }
    return Array.from(map.values());
}

function pickTemplateRow(rows: EmailTemplateRow[], tenantId: string | null): EmailTemplateRow | null {
    if (!rows.length) return null;
    if (tenantId) {
        return rows.find((r) => r.tenant_id === tenantId) ?? rows.find((r) => r.tenant_id === null) ?? rows[0] ?? null;
    }
    return rows.find((r) => r.tenant_id === null) ?? rows[0] ?? null;
}

export const emailCampaignService = {
    async getMarketingContacts(): Promise<{ contacts: MarketingContact[]; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { contacts: [], error: 'No active tenant' };
            const res = await fetch(`/api/email/campaigns?tenantId=${encodeURIComponent(tenantId)}&mode=contacts`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to load contacts');
            const contacts: MarketingContact[] = (payload.contacts || [])
                .filter((c: any) => typeof c.email === 'string' && c.email.trim().length > 0)
                .map((c: any) => {
                    const safeName = String(c.name || '').trim();
                    const parts = safeName.split(/\s+/).filter(Boolean);
                    return {
                        id: c.id,
                        name: safeName || String(c.email),
                        email: String(c.email).trim(),
                        company: c.website || undefined,
                        industry: c.industry || undefined,
                        firstName: parts[0] || undefined,
                        lastName: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
                    };
                });

            return { contacts, error: null };
        } catch (err) {
            return { contacts: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get all email templates
     */
    async getTemplates(category?: string): Promise<{ templates: EmailTemplate[]; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            let query = supabase.from('email_templates').select('*');

            if (tenantId) {
                query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
            } else {
                query = query.is('tenant_id', null);
            }

            if (category) {
                query = query.eq('category', category);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            const rows = dedupeTemplatesByName((data || []) as EmailTemplateRow[], tenantId).sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            const templates: EmailTemplate[] = rows.map((t: EmailTemplateRow) => ({
                id: t.id,
                name: t.name,
                subject: t.subject,
                bodyHtml: t.body_html,
                bodyText: t.body_text ?? undefined,
                category: t.category ?? undefined,
                variables: (t.variables as string[]) || [],
                thumbnailUrl: t.thumbnail_url ?? undefined,
                createdBy: t.created_by ?? undefined,
                isSystem: Boolean(t.is_system),
                metadata: (t.metadata as object) || {},
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
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { campaigns: [], error: 'No active tenant' };
            const res = await fetch(`/api/email/campaigns?tenantId=${encodeURIComponent(tenantId)}`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to load campaigns');
            const rows = Array.isArray(payload.campaigns) ? payload.campaigns.slice(0, limit || 100) : [];
            const campaigns: EmailCampaign[] = rows.map((c: any) => ({
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
            metadata?: any;
        }
    ): Promise<{ campaign: EmailCampaign | null; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('No active tenant');
            const res = await fetch('/api/email/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'create',
                    tenantId,
                    userId,
                    ...campaignData,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to create campaign');
            const data = payload.campaign;

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

    async addRecipientsToCampaign(
        campaignId: string,
        contactIds: string[],
        options?: { skipPreviouslyContacted?: boolean }
    ): Promise<{ added: number; skipped: number; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { added: 0, skipped: 0, error: 'No active tenant' };
            const uniqueContactIds = Array.from(new Set(contactIds.filter(Boolean)));
            if (uniqueContactIds.length === 0) return { added: 0, skipped: 0, error: null };
            const res = await fetch('/api/email/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'add_recipients',
                    tenantId,
                    campaignId,
                    contactIds: uniqueContactIds,
                    skipPreviouslyContacted: options?.skipPreviouslyContacted !== false,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to add recipients');
            return { added: Number(payload.added || 0), skipped: Number(payload.skipped || 0), error: null };
        } catch (err) {
            return { added: 0, skipped: 0, error: err instanceof Error ? err.message : 'Unknown error' };
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
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('No active tenant');
            const res = await fetch('/api/email/campaigns', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    campaignId,
                    name: updates.name,
                    subject: updates.subject,
                    status: updates.status,
                    scheduledAt: updates.scheduledAt,
                    metadata: updates.metadata,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to update campaign');
            const data = payload.campaign;

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
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('No active tenant');
            const res = await fetch('/api/email/campaigns', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, campaignId }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to delete campaign');

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

    /**
     * Inject variables into template
     */
    injectVariables(content: string, recipient: RecipientData): string {
        let injected = content;
        const variables = {
            firstName: recipient.firstName || '',
            lastName: recipient.lastName || '',
            company: recipient.company || '',
            name: recipient.firstName ? (recipient.firstName + (recipient.lastName ? ' ' + recipient.lastName : '')) : recipient.email,
            fromName: recipient.fromName || recipient.senderName || 'AlphaClone Systems',
            senderName: recipient.senderName || recipient.fromName || 'AlphaClone Systems',
            ...recipient
        };

        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            injected = injected.replace(regex, String(value || ''));
        });

        return injected;
    },

    /**
     * Send email campaign
     */
    async sendCampaign(campaignId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('No active tenant');
            const res = await fetch('/api/email/campaigns/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, campaignId }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to send campaign');
            return { success: true, error: null };
        } catch (err) {
            console.error('Campaign sending failed:', err);
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    async retryFailedRecipients(campaignId: string): Promise<{ success: boolean; reset: number; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('No active tenant');
            const res = await fetch('/api/email/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, campaignId, mode: 'retry_failed' }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to reset failed recipients');
            return { success: true, reset: Number(payload.reset || 0), error: null };
        } catch (err) {
            return { success: false, reset: 0, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    async diagnoseCampaign(campaignId: string): Promise<{
        issues: string[];
        warnings: string[];
        info: string[];
        error: string | null;
    }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('No active tenant');
            const params = new URLSearchParams({ tenantId, campaignId });
            const res = await fetch(`/api/email/campaigns/diagnose?${params.toString()}`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to diagnose campaign');
            return {
                issues: Array.isArray(payload.issues) ? payload.issues : [],
                warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
                info: Array.isArray(payload.info) ? payload.info : [],
                error: null,
            };
        } catch (err) {
            return {
                issues: [],
                warnings: [],
                info: [],
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    },

    /**
     * Send a single transactional email using a template
     */
    async sendTransactionalEmail(
        to: string,
        templateName: string,
        variables: Record<string, string | number>
    ): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();

            // 1. Check daily limit (100 per day)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (tenantId) {
                const { count, error: countError } = await supabase
                    .from('email_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .gte('created_at', today.toISOString());

                if (countError) console.error('Error checking email limit:', countError);

                if (count !== null && count >= 100) {
                    console.warn(
                        `Daily email limit reached for tenant ${tenantId}. Skipping transactional email: ${templateName}`
                    );
                    return { success: false, error: 'Daily email limit reached' };
                }
            }

            // 2. Fetch template (tenant override wins over global rows)
            let templateQuery = supabase.from('email_templates').select('*').eq('name', templateName);
            if (tenantId) {
                templateQuery = templateQuery.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
            } else {
                templateQuery = templateQuery.is('tenant_id', null);
            }

            const { data: templateRows, error: tError } = await templateQuery;

            if (tError) {
                throw new Error(`Template not found: ${templateName}`);
            }

            const template = pickTemplateRow((templateRows || []) as EmailTemplateRow[], tenantId);

            if (!template) {
                throw new Error(`Template not found: ${templateName}`);
            }

            // 3. Replace variables in subject and body
            let subject = template.subject;
            let html = template.body_html;
            let text = template.body_text ?? '';

            Object.entries(variables).forEach(([key, value]) => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                subject = subject.replace(regex, String(value));
                html = html.replace(regex, String(value));
                text = text.replace(regex, String(value));
            });

            // 4. Send email via provider
            const result = await emailProviderService.sendEmail({
                to,
                subject,
                html,
                text: text || undefined,
                fromName: 'AlphaClone Systems',
                from: 'notifications@alphaclonesystems.com'
            });

            // 5. Log the email
            if (result.success) {
                await supabase.from('email_logs').insert({
                    recipient: to,
                    template_name: templateName,
                    tenant_id: tenantId
                });
            }

            return result;
        } catch (err) {
            console.error(`Transactional email failed (${templateName}):`, err);
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    }
};
