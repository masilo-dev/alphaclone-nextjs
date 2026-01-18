import { supabase } from '../lib/supabase';

export interface IntegrationConfig {
    id: string;
    type: 'slack' | 'github' | 'google_calendar' | 'discord' | 'jira' | 'linear' | 'zapier';
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
            const { data, error } = await supabase
                .from('integrations')
                .upsert({
                    type,
                    name: this.getIntegrationName(type),
                    enabled: true,
                    config,
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

            return {
                integrations: (data || []).map((i: any) => ({
                    id: i.id,
                    type: i.type,
                    name: i.name,
                    enabled: i.enabled,
                    config: i.config,
                    userId: i.user_id,
                    createdAt: i.created_at,
                })),
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
     * Sync event to Google Calendar
     */
    async syncToGoogleCalendar(
        config: GoogleCalendarConfig,
        event: {
            summary: string;
            description?: string;
            start: { dateTime: string; timeZone: string };
            end: { dateTime: string; timeZone: string };
            attendees?: Array<{ email: string }>;
        }
    ): Promise<{ eventId: string | null; error: string | null }> {
        try {
            // In production, use OAuth2 to get access token from refresh token
            // For now, this is a placeholder structure
            const accessToken = await this.getGoogleAccessToken(config);

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${config.calendarId || 'primary'}/events`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(event),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Google Calendar API error');
            }

            const createdEvent = await response.json();
            return { eventId: createdEvent.id, error: null };
        } catch (error) {
            return {
                eventId: null,
                error: error instanceof Error ? error.message : 'Google Calendar sync failed',
            };
        }
    },

    /**
     * Get Google OAuth access token (placeholder)
     */
    async getGoogleAccessToken(config: GoogleCalendarConfig): Promise<string> {
        // In production, exchange refresh token for access token
        // This would use Google OAuth2 API
        return config.refreshToken; // Placeholder
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

