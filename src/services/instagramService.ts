import { createSupabaseAdminClient } from '@/lib/supabase-admin';
<<<<<<< HEAD
import { metaGraphFetch } from '@/lib/meta/metaGraphClient';
import { getInstagramIntegrationWithToken } from '@/services/instagram/instagramIntegrationService';

export const instagramService = {
    async sendInstagramMessage(tenantId: string, _igUserId: string, recipientId: string, text: string) {
        const supabase = createSupabaseAdminClient();
        const integration = await getInstagramIntegrationWithToken(supabase, { tenantId });

        if (!integration?.pageAccessToken) {
            throw new Error(`Failed to find active Facebook/Instagram integration for tenant ${tenantId}`);
        }

        const response = await metaGraphFetch(
            'me/messages',
            integration.pageAccessToken,
=======

export const instagramService = {
    /**
     * Send an Instagram Direct Message to a recipient
     */
    async sendInstagramMessage(tenantId: string, igUserId: string, recipientId: string, text: string) {
        const supabase = createSupabaseAdminClient();

        // 1. Get the Page Access Token (Instagram uses the linked Facebook Page token)
        const { data: integration, error: intError } = await supabase
            .from('facebook_integrations')
            .select('page_access_token')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            // We look for any active integration for this tenant that might be linked to IG
            .single();

        if (intError || !integration?.page_access_token) {
            throw new Error(`Failed to find active Facebook/Instagram integration for tenant ${tenantId}`);
        }

        // 2. Call Facebook Graph API to send the Instagram message
        // Endpoint is the same as Messenger but requires instagram_manage_messages permission
        const response = await fetch(
            `https://graph.facebook.com/v19.0/me/messages?access_token=${integration.page_access_token}`,
>>>>>>> origin/main
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text },
<<<<<<< HEAD
=======
                    // Instagram uses the same structure but identifies recipients by their IGID
>>>>>>> origin/main
                }),
            }
        );

        const result = await response.json();

        if (!response.ok) {
            console.error('Instagram Send API error:', result);
<<<<<<< HEAD
            throw new Error((result as { error?: { message?: string } }).error?.message || 'Failed to send Instagram message');
=======
            throw new Error(result.error?.message || 'Failed to send Instagram message');
>>>>>>> origin/main
        }

        return result;
    }
};
