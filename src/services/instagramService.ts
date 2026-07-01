import { createSupabaseAdminClient } from '@/lib/supabase-admin';
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
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text },
                }),
            }
        );

        const result = await response.json();

        if (!response.ok) {
            console.error('Instagram Send API error:', result);
            throw new Error((result as { error?: { message?: string } }).error?.message || 'Failed to send Instagram message');
        }

        return result;
    }
};
