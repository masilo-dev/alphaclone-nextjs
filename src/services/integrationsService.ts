import { supabase } from '../lib/supabase';
import { encryptIntegrationConfig } from '@/lib/integration/integrationTokenCrypto';

export interface IntegrationConfig {
    id: string;
<<<<<<< HEAD
    type: 'slack' | 'github' | 'google_calendar' | 'discord' | 'jira' | 'linear' | 'zapier' | 'twilio' | 'sendgrid' | 'resend' | 'brevo' | 'zoho' | 'gmail' | 'facebook' | 'microsoft';
=======
    type: 'slack' | 'github' | 'google_calendar' | 'discord' | 'jira' | 'linear' | 'zapier' | 'twilio' | 'sendgrid' | 'resend' | 'brevo';
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
    name: string;
    enabled: boolean;
    config: Record<string, any>;
    userId: string;
    createdAt: string;
}

export interface SlackConfig {
    webhookUrl: string;
    channel?: string;
    username?: string;
}

export interface GitHubConfig {
    token: string;
    owner: string;
    repo: string;
    branch?: string;
}

export interface GoogleCalendarConfig {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    calendarId?: string;
}


export const integrationsService = {
    /**
     * Save integration configuration
     */
    async saveIntegration(
        type: IntegrationConfig['type'],
        config: Record<string, any>,
        userId: string
    ): Promise<{ integration: IntegrationConfig | null; error: string | null }> {
        try {
            const encryptedConfig = await encryptIntegrationConfig(config);
            const { data, error } = await supabase
                .from('integrations')
                .upsert({
                    type,
                    name: this.getIntegrationName(type),
                    enabled: true,
                    config: encryptedConfig,
                    user_id: userId,
                }, {
                    onConflict: 'type,user_id',
                })
                .select()
                .single();

            if (error) throw error;

            return {
                integration: {
                    id: data.id,
                    type: data.type,
                    name: data.name,
                    enabled: data.enabled,
                    config: data.config,
                    userId: data.user_id,
                    createdAt: data.created_at,
                },
                error: null,
            };
        } catch (error) {
            return {
                integration: null,
                error: error instanceof Error ? error.message : 'Failed to save integration',
            };
        }
    },

    /**
     * Get user integrations
     */
    async getUserIntegrations(userId: string): Promise<{ integrations: IntegrationConfig[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('integrations')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const { data: microsoftConnection } = await supabase
                .from('microsoft_connections')
                .select('id, microsoft_email, display_name, created_at')
                .eq('user_id', userId)
                .maybeSingle();

            const integrations = (data || []).map((i: any) => ({
                id: i.id,
                type: i.type,
                name: i.name,
                enabled: i.enabled,
                config: i.config,
                userId: i.user_id,
                createdAt: i.created_at,
            }));

            if (microsoftConnection) {
                integrations.unshift({
                    id: microsoftConnection.id,
                    type: 'microsoft',
                    name: 'Microsoft 365',
                    enabled: true,
                    config: {
                        fromEmail: microsoftConnection.microsoft_email,
                        displayName: microsoftConnection.display_name,
                    },
                    userId,
                    createdAt: microsoftConnection.created_at,
                });
            }

            return {
                integrations,
                error: null,
            };
        } catch (error) {
            return {
                integrations: [],
                error: error instanceof Error ? error.message : 'Failed to fetch integrations',
            };
        }
    },

    /**
     * Send Slack notification
     */
    async sendSlackNotification(
        webhookUrl: string,
        message: string,
        options?: {
            channel?: string;
            username?: string;
            attachments?: any[];
        }
    ): Promise<{ success: boolean; error: string | null }> {
        try {
            const payload = {
                text: message,
                channel: options?.channel,
                username: options?.username || 'AlphaClone',
                attachments: options?.attachments,
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Slack API error: ${response.statusText}`);
            }

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Slack notification failed',
            };
        }
    },

    /**
     * Create GitHub issue
     */
    async createGitHubIssue(
        config: GitHubConfig,
        title: string,
        body: string,
        labels?: string[]
    ): Promise<{ issue: any | null; error: string | null }> {
        try {
            const response = await fetch(
                `https://api.github.com/repos/${config.owner}/${config.repo}/issues`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${config.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title,
                        body,
                        labels: labels || [],
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'GitHub API error');
            }

            const issue = await response.json();
            return { issue, error: null };
        } catch (error) {
            return {
                issue: null,
                error: error instanceof Error ? error.message : 'GitHub issue creation failed',
            };
        }
    },

    /**
     * Send Discord webhook
     */
    async sendDiscordNotification(
        webhookUrl: string,
        message: string,
        options?: {
            username?: string;
            avatarUrl?: string;
            embeds?: any[];
        }
    ): Promise<{ success: boolean; error: string | null }> {
        try {
            const payload = {
                content: message,
                username: options?.username,
                avatar_url: options?.avatarUrl,
                embeds: options?.embeds,
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Discord API error: ${response.statusText}`);
            }

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Discord notification failed',
            };
        }
    },

    /**
     * Trigger webhook (for Zapier/Make)
     */
    async triggerWebhook(
        webhookUrl: string,
        data: Record<string, any>
    ): Promise<{ success: boolean; error: string | null }> {
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error(`Webhook error: ${response.statusText}`);
            }

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Webhook trigger failed',
            };
        }
    },

    /**
     * Get integration name
     */
    getIntegrationName(type: IntegrationConfig['type']): string {
        const names: Record<IntegrationConfig['type'], string> = {
            slack: 'Slack',
            github: 'GitHub',
            google_calendar: 'Google Calendar',
            discord: 'Discord',
            jira: 'Jira',
            linear: 'Linear',
            zapier: 'Zapier',
            twilio: 'Twilio',
            sendgrid: 'SendGrid',
            resend: 'Resend',
            brevo: 'Brevo',
<<<<<<< HEAD
            zoho: 'Zoho Mail',
            gmail: 'Gmail',
            facebook: 'Facebook',
            microsoft: 'Microsoft 365',
=======
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
        };
        return names[type] || type;
    },

    /**
     * Disable integration
     */
    async disableIntegration(integrationId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase
                .from('integrations')
                .update({ enabled: false })
                .eq('id', integrationId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to disable integration',
            };
        }
    },

    /**
     * Delete integration
     */
    async deleteIntegration(integrationId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase
                .from('integrations')
                .delete()
                .eq('id', integrationId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete integration',
            };
        }
    },
};
