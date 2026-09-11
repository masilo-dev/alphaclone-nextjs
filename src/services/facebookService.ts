import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  getFacebookIntegration,
  getFacebookTokens,
  markFacebookIntegrationInactive,
} from '@/services/facebook/facebookIntegrationService';
import { metaGraphFetch } from '@/lib/meta/metaGraphClient';

export const facebookService = {
    async validateAndRefreshIntegration(tenantId: string, pageId: string) {
        const supabase = createSupabaseAdminClient();
        const integration = await getFacebookIntegration(supabase, { tenantId, pageId });
        if (!integration) {
            throw new Error(`Integration not found for page ${pageId}`);
        }

        const tokens = await getFacebookTokens(supabase, integration);
        const now = new Date();
        const expiresAt = integration.expires_at ? new Date(integration.expires_at) : null;
        const isExpiringSoon = expiresAt && (expiresAt.getTime() - now.getTime()) < 1000 * 60 * 60 * 24 * 3;

        if (isExpiringSoon || !tokens.pageAccessToken) {
            await supabase.from('facebook_integrations').update({
                metadata: {
                    ...(integration.metadata || {}),
                    health_warning: 'Token is expiring soon or missing. Re-authentication recommended.',
                    last_health_check: now.toISOString()
                }
            }).eq('id', integration.id);
        }

        return { ...integration, pageAccessToken: tokens.pageAccessToken, userAccessToken: tokens.userAccessToken };
    },

    async sendMessengerMessage(tenantId: string, pageId: string, recipientId: string, text: string) {
        const supabase = createSupabaseAdminClient();
        const integration = await this.validateAndRefreshIntegration(tenantId, pageId);

        if (!integration.pageAccessToken) {
            throw new Error('Missing page access token. Please reconnect Facebook.');
        }

        const response = await metaGraphFetch(
            'me/messages',
            integration.pageAccessToken,
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
            const errorCode = (result as { error?: { code?: number; message?: string } }).error?.code;
            await markFacebookIntegrationInactive(
                supabase,
                integration.id,
                errorCode === 190 ? 'token_revoked_or_invalid' : 'messenger_send_failed'
            ).catch(() => undefined);
            throw new Error((result as { error?: { message?: string } }).error?.message || 'Failed to send Messenger message');
        }

        return result;
    },

    async subscribePage(tenantId: string, pageId: string) {
        const supabase = createSupabaseAdminClient();
        const integration = await this.validateAndRefreshIntegration(tenantId, pageId);

        if (!integration.pageAccessToken) {
            throw new Error('Missing page access token. Please reconnect Facebook.');
        }

        const response = await metaGraphFetch(
            `${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads,message_echoes,leadgen`,
            integration.pageAccessToken,
            { method: 'POST' }
        );

        const result = await response.json();

        if (!response.ok) {
            console.error('Facebook Subscribe API error:', result);
            await supabase.from('facebook_integrations').update({
                metadata: {
                    ...(integration.metadata || {}),
                    last_error: (result as { error?: { message?: string } }).error?.message || 'Failed to subscribe page',
                    last_error_at: new Date().toISOString()
                }
            }).eq('id', integration.id);
            throw new Error((result as { error?: { message?: string } }).error?.message || 'Failed to subscribe page to webhooks');
        }

        return result;
    },

    async publishPost(tenantId: string, pageId: string, message: string, mediaUrl?: string, mediaType: 'image' | 'video' = 'image') {
        const integration = await this.validateAndRefreshIntegration(tenantId, pageId);

        if (!integration.pageAccessToken) {
            throw new Error('Missing page access token. Please reconnect Facebook.');
        }

        const token = integration.pageAccessToken;
        let path = `${pageId}/feed`;
        let body: Record<string, string> = { message };

        if (mediaUrl) {
            if (mediaType === 'video') {
                path = `${pageId}/videos`;
                body = { description: message, file_url: mediaUrl };
            } else {
                path = `${pageId}/photos`;
                body = { message, url: mediaUrl };
            }
        }

        const response = await metaGraphFetch(path, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Facebook Publish API error:', result);
            throw new Error((result as { error?: { message?: string } }).error?.message || 'Failed to publish to Facebook');
        }

        return result;
    }
};
