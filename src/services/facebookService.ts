import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const facebookService = {
    /**
     * Send a Messenger message to a recipient
     */
    async sendMessengerMessage(tenantId: string, pageId: string, recipientId: string, text: string) {
        const supabase = createSupabaseAdminClient();

        // 1. Get the Page Access Token for this tenant and page
        const { data: integration, error: intError } = await supabase
            .from('facebook_integrations')
            .select('page_access_token')
            .eq('tenant_id', tenantId)
            .eq('page_id', pageId)
            .eq('is_active', true)
            .single();

        if (intError || !integration?.page_access_token) {
            throw new Error(`Failed to find active Facebook integration for page ${pageId}: ${intError?.message}`);
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
            throw new Error(result.error?.message || 'Failed to send Messenger message');
        }

        return result;
    }
};
