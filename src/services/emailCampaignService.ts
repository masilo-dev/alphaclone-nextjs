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

            const { data, error } = await supabase
                .from('business_clients')
                .select('id, name, email, website')
                .eq('tenant_id', tenantId)
                .not('email', 'is', null)
                .order('name', { ascending: true });

            if (error) throw error;

            const contacts: MarketingContact[] = (data || [])
                .filter((c: any) => typeof c.email === 'string' && c.email.trim().length > 0)
                .map((c: any) => {
                    const safeName = String(c.name || '').trim();
                    const parts = safeName.split(/\s+/).filter(Boolean);
                    return {
                        id: c.id,
                        name: safeName || String(c.email),
                        email: String(c.email).trim(),
                        company: c.website || undefined,
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
            metadata?: any;
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
                    metadata: campaignData.metadata || {},
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

            const { data: contacts, error: contactsError } = await supabase
                .from('business_clients')
                .select('id, email')
                .eq('tenant_id', tenantId)
                .in('id', uniqueContactIds);
            if (contactsError) throw contactsError;

            const validContacts = (contacts || []).filter((c: any) => c.email && String(c.email).trim().length > 0);
            if (validContacts.length === 0) return { added: 0, skipped: uniqueContactIds.length, error: null };

            const emails = validContacts.map((c: any) => String(c.email).trim().toLowerCase());

            const { data: existingCampaignRecipients, error: existingCampaignError } = await supabase
                .from('campaign_recipients')
                .select('email')
                .eq('campaign_id', campaignId)
                .eq('tenant_id', tenantId);
            if (existingCampaignError) throw existingCampaignError;
            const existingCampaignEmails = new Set((existingCampaignRecipients || []).map((r: any) => String(r.email).trim().toLowerCase()));

            let previouslyContactedEmails = new Set<string>();
            if (options?.skipPreviouslyContacted !== false) {
                const { data: previous, error: previousError } = await supabase
                    .from('campaign_recipients')
                    .select('email')
                    .eq('tenant_id', tenantId)
                    .in('email', emails)
                    .in('status', ['sent', 'delivered', 'opened', 'clicked']);
                if (previousError) throw previousError;
                previouslyContactedEmails = new Set((previous || []).map((r: any) => String(r.email).trim().toLowerCase()));
            }

            const rowsToInsert = validContacts
                .filter((c: any) => {
                    const normalizedEmail = String(c.email).trim().toLowerCase();
                    if (existingCampaignEmails.has(normalizedEmail)) return false;
                    if (previouslyContactedEmails.has(normalizedEmail)) return false;
                    return true;
                })
                .map((c: any) => ({
                    tenant_id: tenantId,
                    campaign_id: campaignId,
                    contact_id: c.id,
                    email: String(c.email).trim(),
                    status: 'pending',
                }));

            if (rowsToInsert.length > 0) {
                const { error: insertError } = await supabase.from('campaign_recipients').insert(rowsToInsert);
                if (insertError) throw insertError;
            }

            const skipped = validContacts.length - rowsToInsert.length;
            await supabase
                .from('email_campaigns')
                .update({ total_recipients: rowsToInsert.length + (existingCampaignRecipients?.length || 0) })
                .eq('id', campaignId)
                .eq('tenant_id', tenantId);

            return { added: rowsToInsert.length, skipped, error: null };
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
            // 1. Get campaign and recipients
            const { data: campaign, error: cError } = await supabase
                .from('email_campaigns')
                .select('*')
                .eq('id', campaignId)
                .single();

            if (cError) throw cError;

            const { data: recipients, error: rError } = await supabase
                .from('campaign_recipients')
                .select('*')
                .eq('campaign_id', campaignId)
                .eq('status', 'pending');

            if (rError) throw rError;

            if (!recipients || recipients.length === 0) {
                return { success: true, error: 'No pending recipients' };
            }

            // 2. Update status to sending
            await supabase.from('email_campaigns').update({ status: 'sending', sent_at: new Date().toISOString() }).eq('id', campaignId);

            // 3. Send emails
            let sentCount = 0;
            let failCount = 0;

            for (const recipient of recipients) {
                // 3a. Get contact data for personalization
                const { data: contact } = await supabase
                    .from('business_clients')
                    .select('id, name, email, website, custom_fields')
                    .eq('id', recipient.contact_id)
                    .single();

                const contactName = String(contact?.name || '').trim();
                const nameParts = contactName.split(/\s+/).filter(Boolean);

                const recipientData: RecipientData = {
                    id: recipient.contact_id,
                    email: recipient.email,
                    firstName: nameParts[0] || undefined,
                    lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined,
                    company: contact?.website || undefined,
                    name: contactName || recipient.email,
                    ...((contact?.custom_fields as Record<string, unknown>) || {})
                };

                const personalizedHtml = this.injectVariables(
                    campaign.metadata?.bodyHtml || campaign.body_html || 'Empty email body',
                    recipientData
                );

                const personalizedSubject = this.injectVariables(campaign.subject, recipientData);

                const result = await emailProviderService.sendEmail({
                    to: recipient.email,
                    subject: personalizedSubject,
                    html: personalizedHtml,
                    fromName: campaign.from_name,
                    from: campaign.from_email,
                    replyTo: campaign.reply_to
                });

                if (result.success) {
                    sentCount++;
                    await supabase.from('campaign_recipients')
                        .update({ status: 'sent', sent_at: new Date().toISOString() })
                        .eq('id', recipient.id);
                } else {
                    failCount++;
                    await supabase.from('campaign_recipients')
                        .update({ status: 'failed', error_message: result.error || 'Unknown error' })
                        .eq('id', recipient.id);
                }
            }

            // 4. Update metrics
            await supabase.from('email_campaigns').update({
                status: 'sent',
                total_sent: sentCount,
                completed_at: new Date().toISOString()
            }).eq('id', campaignId);

            return { success: true, error: null };
        } catch (err) {
            console.error('Campaign sending failed:', err);
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
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
                from: 'notifications@alphaclone.tech'
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
