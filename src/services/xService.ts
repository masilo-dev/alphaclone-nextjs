import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface XIntegration {
    id: string;
    tenant_id: string;
    user_id: string;
    x_user_id: string;
    x_username: string;
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
    scopes?: string[];
}

export interface XTweet {
    text: string;
    media_ids?: string[];
    reply_settings?: 'everyone' | 'following' | 'mentionedUsers';
}

export const xService = {
    /**
     * Get X integration for a tenant
     */
    async getXIntegration(tenantId: string) {
        const supabase = createSupabaseAdminClient();
        
        const { data, error } = await supabase
            .from('x_integrations')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching X integration:', error);
            return null;
        }
        
        return data as XIntegration | null;
    },

    /**
     * Save X integration
     */
    async saveXIntegration(integration: Partial<XIntegration>) {
        const supabase = createSupabaseAdminClient();
        
        const { data, error } = await supabase
            .from('x_integrations')
            .upsert({
                ...integration,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) {
            console.error('Error saving X integration:', error);
            throw error;
        }
        
        return data;
    },

    /**
     * Post a tweet (v2)
     */
    async postTweet(tenantId: string, tweet: XTweet) {
        const integration = await this.getXIntegration(tenantId);
        if (!integration) throw new Error('X integration not found');

        const response = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${integration.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: tweet.text,
                ...(tweet.reply_settings && { reply_settings: tweet.reply_settings })
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`X API error: ${JSON.stringify(error)}`);
        }

        return await response.json();
    },

    /**
     * Send a Direct Message (v2)
     */
    async sendDirectMessage(tenantId: string, recipientId: string, text: string) {
        const integration = await this.getXIntegration(tenantId);
        if (!integration) throw new Error('X integration not found');

        const response = await fetch(`https://api.twitter.com/2/dm_conversations/with/${recipientId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${integration.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: {
                    text: text
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`X API error: ${JSON.stringify(error)}`);
        }

        return await response.json();
    },

    /**
     * Read Tweets (v2) - User Timeline
     */
    async getUserTweets(tenantId: string) {
        const integration = await this.getXIntegration(tenantId);
        if (!integration) throw new Error('X integration not found');

        const response = await fetch(`https://api.twitter.com/2/users/${integration.x_user_id}/tweets`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${integration.access_token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`X API error: ${JSON.stringify(error)}`);
        }

        return await response.json();
    },

    /**
     * Read Direct Messages (v2)
     */
    async getDirectMessages(tenantId: string) {
        const integration = await this.getXIntegration(tenantId);
        if (!integration) throw new Error('X integration not found');

        const response = await fetch('https://api.twitter.com/2/dm_events', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${integration.access_token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`X API error: ${JSON.stringify(error)}`);
        }

        return await response.json();
    }
};
