import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const facebookService = {
    /**
     * Validate an integration and log errors if it's failing
     */
    async validateAndRefreshIntegration(tenantId: string, pageId: string) {
        const supabase = createSupabaseAdminClient();

        const { data: integration, error: intError } = await supabase
            .from('facebook_integrations')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('page_id', pageId)
            .single();

        if (intError || !integration) {
            throw new Error(`Integration not found for page ${pageId}`);
        }

        // Check if token is likely expired
        const now = new Date();
        const expiresAt = integration.expires_at ? new Date(integration.expires_at) : null;
        const isExpiringSoon = expiresAt && (expiresAt.getTime() - now.getTime()) < 1000 * 60 * 60 * 24 * 3; // 3 days

        if (isExpiringSoon || !integration.page_access_token) {
            // Log a health warning
            await supabase.from('facebook_integrations').update({
                metadata: {
                    ...integration.metadata,
                    health_warning: 'Token is expiring soon or missing. Re-authentication recommended.',
                    last_health_check: now.toISOString()
                }
            }).eq('id', integration.id);
        }

        return integration;
    },

    /**
     * Send a Messenger message to a recipient
     */
    async sendMessengerMessage(tenantId: string, pageId: string, recipientId: string, text: string) {
        const supabase = createSupabaseAdminClient();
        const integration = await this.validateAndRefreshIntegration(tenantId, pageId);

        if (!integration.page_access_token) {
            throw new Error('Missing page access token. Please reconnect Facebook.');
        }

        // 2. Call Facebook Graph API to send the message
        const response = await fetch(
            `https://graph.facebook.com/v19.0/me/messages?access_token=${integration.page_access_token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text },
                    messaging_type: 'RESPONSE',
                }),
            }
        );

        const result = await response.json();

        if (!response.ok) {
            console.error('Facebook Send API error:', result);
            
            // Log the error to the integration record for visibility in the dashboard
            await supabase.from('facebook_integrations').update({
                is_active: result.error?.code === 190 ? false : integration.is_active, // Deactivate if token is invalid
                metadata: {
                    ...integration.metadata,
                    last_error: result.error?.message || 'Unknown Facebook API error',
                    last_error_at: new Date().toISOString(),
                    last_error_code: result.error?.code
                }
            }).eq('id', integration.id);

            throw new Error(result.error?.message || 'Failed to send Messenger message');
        }

        return result;
    },

    /**
     * Subscribe a Facebook Page to our app webhooks
     */
    async subscribePage(tenantId: string, pageId: string) {
        const supabase = createSupabaseAdminClient();
        const integration = await this.validateAndRefreshIntegration(tenantId, pageId);

        if (!integration.page_access_token) {
            throw new Error('Missing page access token. Please reconnect Facebook.');
        }

        const response = await fetch(
            `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads,message_echoes,leadgen&access_token=${integration.page_access_token}`,
            {
                method: 'POST'
            }
        );

        const result = await response.json();

        if (!response.ok) {
            console.error('Facebook Subscribe API error:', result);
            
            await supabase.from('facebook_integrations').update({
                metadata: {
                    ...integration.metadata,
                    last_error: result.error?.message || 'Failed to subscribe page',
                    last_error_at: new Date().toISOString()
                }
            }).eq('id', integration.id);

            throw new Error(result.error?.message || 'Failed to subscribe page to webhooks');
        }

        return result;
    },

    /**
     * Publish a post to a Facebook Page (supports text, images, and videos)
     */
    async publishPost(tenantId: string, pageId: string, message: string, mediaUrl?: string, mediaType: 'image' | 'video' = 'image') {
        const supabase = createSupabaseAdminClient();
        const integration = await this.validateAndRefreshIntegration(tenantId, pageId);

        if (!integration.page_access_token) {
            throw new Error('Missing page access token. Please reconnect Facebook.');
        }

        let endpoint = `https://graph.facebook.com/v19.0/${pageId}/feed`;
        let body: any = { message, access_token: integration.page_access_token };

        if (mediaUrl) {
            if (mediaType === 'video') {
                endpoint = `https://graph.facebook.com/v19.0/${pageId}/videos`;
                body = {
                    description: message,
                    file_url: mediaUrl,
                    access_token: integration.page_access_token
                };
            } else {
                endpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`;
                body = {
                    message,
                    url: mediaUrl,
                    access_token: integration.page_access_token
                };
            }
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Facebook Publish API error:', result);
            throw new Error(result.error?.message || 'Failed to publish to Facebook');
        }

        return result;
    }
};
