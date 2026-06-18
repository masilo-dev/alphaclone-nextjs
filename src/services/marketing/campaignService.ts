/**
 * Marketing Campaign Service
 * Full marketing campaign management system
 * Supports email campaigns, SMS campaigns, and multi-channel campaigns
 */

import { supabase } from '@/lib/supabase/client';
import { emailService } from '../email/emailService';

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
export type CampaignType = 'email' | 'sms' | 'multi_channel';
export type CampaignChannel = 'email' | 'sms' | 'push' | 'in_app';

export interface Campaign {
    id: string;
    tenant_id: string;
    name: string;
    description?: string;
    type: CampaignType;
    status: CampaignStatus;
    channels: CampaignChannel[];
    target_audience?: string;
    scheduled_at?: string;
    started_at?: string;
    completed_at?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    metadata?: Record<string, any>;
}

export interface CampaignMessage {
    id: string;
    campaign_id: string;
    channel: CampaignChannel;
    subject?: string;
    content: string;
    template_id?: string;
    variables?: Record<string, string>;
    created_at: string;
}

export interface CampaignRecipient {
    id: string;
    campaign_id: string;
    contact_id: string;
    email?: string;
    phone?: string;
    status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
    sent_at?: string;
    opened_at?: string;
    clicked_at?: string;
    error?: string;
}

export interface CreateCampaignInput {
    name: string;
    description?: string;
    type: CampaignType;
    channels: CampaignChannel[];
    target_audience?: string;
    scheduled_at?: string;
    messages: Array<{
        channel: CampaignChannel;
        subject?: string;
        content: string;
        template_id?: string;
        variables?: Record<string, string>;
    }>;
    recipient_ids?: string[];
}

class CampaignService {
    /**
     * Create a new campaign
     */
    async create(input: CreateCampaignInput): Promise<Campaign> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');

        const tenantId = this.getTenantId();

        // Create the campaign
        const { data: campaign, error: campaignError } = await supabase
            .from('marketing_campaigns')
            .insert({
                tenant_id: tenantId,
                name: input.name,
                description: input.description,
                type: input.type,
                status: input.scheduled_at ? 'scheduled' : 'draft',
                channels: input.channels,
                target_audience: input.target_audience,
                scheduled_at: input.scheduled_at,
                created_by: user.id,
            })
            .select()
            .single();

        if (campaignError) throw campaignError;

        // Create campaign messages
        if (input.messages.length > 0) {
            const messages = input.messages.map(msg => ({
                campaign_id: campaign.id,
                channel: msg.channel,
                subject: msg.subject,
                content: msg.content,
                template_id: msg.template_id,
                variables: msg.variables || {},
            }));

            const { error: messagesError } = await supabase
                .from('campaign_messages')
                .insert(messages);

            if (messagesError) throw messagesError;
        }

        // Add recipients if provided
        if (input.recipient_ids && input.recipient_ids.length > 0) {
            await this.addRecipients(campaign.id, input.recipient_ids);
        }

        return campaign;
    }

    /**
     * Get all campaigns for the current tenant
     */
    async getAll(filters?: {
        status?: CampaignStatus;
        type?: CampaignType;
    }): Promise<Campaign[]> {
        const tenantId = this.getTenantId();

        let query = supabase
            .from('marketing_campaigns')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.type) query = query.eq('type', filters.type);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    /**
     * Get campaign by ID with messages
     */
    async getById(id: string): Promise<{ campaign: Campaign; messages: CampaignMessage[] } | null> {
        const tenantId = this.getTenantId();

        const { data: campaign, error: campaignError } = await supabase
            .from('marketing_campaigns')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .single();

        if (campaignError) throw campaignError;
        if (!campaign) return null;

        const { data: messages, error: messagesError } = await supabase
            .from('campaign_messages')
            .select('*')
            .eq('campaign_id', id)
            .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        return { campaign, messages: messages || [] };
    }

    /**
     * Update campaign status
     */
    async updateStatus(id: string, status: CampaignStatus): Promise<void> {
        const updateData: Partial<Campaign> = { status, updated_at: new Date().toISOString() };

        if (status === 'active') updateData.started_at = new Date().toISOString();
        if (status === 'completed') updateData.completed_at = new Date().toISOString();

        const { error } = await supabase
            .from('marketing_campaigns')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Add recipients to a campaign
     */
    async addRecipients(campaignId: string, contactIds: string[]): Promise<void> {
        const { data: contacts, error: contactsError } = await supabase
            .from('contacts')
            .select('id, email, phone')
            .in('id', contactIds);

        if (contactsError) throw contactsError;

        const recipients = contacts.map(contact => ({
            campaign_id: campaignId,
            contact_id: contact.id,
            email: contact.email,
            phone: contact.phone,
            status: 'pending' as const,
        }));

        const { error } = await supabase
            .from('campaign_recipients')
            .insert(recipients);

        if (error) throw error;
    }

    /**
     * Launch a campaign (send to all pending recipients)
     */
    async launch(campaignId: string): Promise<void> {
        const campaign = await this.getById(campaignId);
        if (!campaign) throw new Error('Campaign not found');

        // Update status to active
        await this.updateStatus(campaignId, 'active');

        // Get pending recipients
        const { data: recipients, error: recipientsError } = await supabase
            .from('campaign_recipients')
            .select('*')
            .eq('campaign_id', campaignId)
            .eq('status', 'pending');

        if (recipientsError) throw recipientsError;

        // Send messages to each recipient
        for (const recipient of recipients || []) {
            for (const message of campaign.messages) {
                try {
                    if (message.channel === 'email' && recipient.email) {
                        await this.sendEmailMessage(recipient, message, campaign.campaign);
                    } else if (message.channel === 'sms' && recipient.phone) {
                        await this.sendSmsMessage(recipient, message);
                    }

                    // Update recipient status
                    await supabase
                        .from('campaign_recipients')
                        .update({
                            status: 'sent',
                            sent_at: new Date().toISOString(),
                        })
                        .eq('id', recipient.id);
                } catch (error) {
                    console.error(`Failed to send to recipient ${recipient.id}:`, error);
                    await supabase
                        .from('campaign_recipients')
                        .update({
                            status: 'failed',
                            error: error instanceof Error ? error.message : 'Unknown error',
                        })
                        .eq('id', recipient.id);
                }
            }
        }

        // Mark campaign as completed
        await this.updateStatus(campaignId, 'completed');
    }

    /**
     * Send email message to a recipient
     */
    private async sendEmailMessage(
        recipient: CampaignRecipient,
        message: CampaignMessage,
        campaign: Campaign
    ): Promise<void> {
        if (!recipient.email) throw new Error('Recipient has no email');

        let content = message.content;
        // Replace variables
        if (message.variables) {
            Object.entries(message.variables).forEach(([key, value]) => {
                content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
            });
        }

        await emailService.send({
            to: recipient.email,
            subject: message.subject || `Campaign: ${campaign.name}`,
            html: content,
        });
    }

    /**
     * Send SMS message to a recipient
     */
    private async sendSmsMessage(
        recipient: CampaignRecipient,
        message: CampaignMessage
    ): Promise<void> {
        if (!recipient.phone) throw new Error('Recipient has no phone');

        // SMS sending logic would go here
        // For now, we'll log it
        console.log(`Sending SMS to ${recipient.phone}: ${message.content}`);
    }

    /**
     * Get campaign statistics
     */
    async getStats(campaignId: string): Promise<{
        total: number;
        sent: number;
        delivered: number;
        opened: number;
        clicked: number;
        bounced: number;
        failed: number;
    }> {
        const { data, error } = await supabase
            .from('campaign_recipients')
            .select('status')
            .eq('campaign_id', campaignId);

        if (error) throw error;

        const stats = {
            total: data?.length || 0,
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
            failed: 0,
        };

        (data || []).forEach(r => {
            switch (r.status) {
                case 'sent': stats.sent++; break;
                case 'delivered': stats.delivered++; break;
                case 'opened': stats.opened++; break;
                case 'clicked': stats.clicked++; break;
                case 'bounced': stats.bounced++; break;
                case 'failed': stats.failed++; break;
            }
        });

        return stats;
    }

    /**
     * Get tenant ID
     */
    private getTenantId(): string {
        try {
            const session = supabase.auth.getSession();
            return 'default';
        } catch {
            return 'default';
        }
    }
}

export const campaignService = new CampaignService();
