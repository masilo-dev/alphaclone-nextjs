import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';

export const zohoServerService = {
    /**
     * Get valid access token (refreshes if needed)
     */
    async getValidToken(userId: string): Promise<string | null> {
        const supabaseAdmin = createSupabaseAdminClient();
        const { data: integration, error } = await supabaseAdmin
            .from('integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .maybeSingle();

        if (error || !integration || !integration.config) return null;

        const config = integration.config;
        const expiresAt = new Date(config.expiryDate).getTime();

        if (Date.now() < expiresAt - 60000) { // If it expires in more than a minute
            return config.accessToken;
        }

        // Refresh token
        return await this.refreshToken(userId, config.refreshToken, integration.id);
    },

    /**
     * Refresh Zoho OAuth Token
     */
    async refreshToken(userId: string, refreshToken: string, integrationId: string): Promise<string | null> {
        try {
            const supabaseAdmin = createSupabaseAdminClient();

            // Get current config to merge and find the right accountsServer
            const { data: currentIntegration } = await supabaseAdmin
                .from('integrations')
                .select('config')
                .eq('id', integrationId)
                .single();

            const accountsServer = currentIntegration?.config?.accountsServer || 'https://accounts.zoho.com';

            const response = await fetch(`${accountsServer}/oauth/v2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    refresh_token: refreshToken,
                    client_id: ENV.ZOHO_CLIENT_ID || '',
                    client_secret: ENV.ZOHO_CLIENT_SECRET || '',
                    grant_type: 'refresh_token',
                }),
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

            const updatedConfig = {
                ...(currentIntegration?.config || {}),
                accessToken: data.access_token,
                expiryDate: expiresAt,
            };

            await supabaseAdmin
                .from('integrations')
                .update({ config: updatedConfig })
                .eq('id', integrationId);

            return data.access_token;
        } catch (err) {
            console.error('Failed to refresh Zoho token:', err);
            return null;
        }
    },

    /**
     * Proxy request to Zoho Mail API
     */
    async proxyRequest(userId: string, endpoint: string, options: RequestInit = {}) {
        const token = await this.getValidToken(userId);
        if (!token) throw new Error('Zoho not connected');

        // Need accountId for most requests. We should store it in config.
        const supabaseAdmin = createSupabaseAdminClient();
        const { data: integration } = await supabaseAdmin
            .from('integrations')
            .select('config')
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .single();

        const accountId = integration?.config?.accountId;
        if (!accountId && !endpoint.includes('accounts')) {
            throw new Error('Zoho account ID not found');
        }

        const mailApiHost = integration?.config?.mailApiHost || 'mail.zoho.com';
        const baseUrl = `https://${mailApiHost}/api/accounts`;
        const url = endpoint.startsWith('http')
            ? endpoint
            : accountId
                ? `${baseUrl}/${accountId}/${endpoint}`
                : `${baseUrl}/${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Zoho-oauthtoken ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ status: { description: 'Zoho API request failed' } }));
            throw new Error(error.status?.description || 'Zoho API request failed');
        }

        return await response.json();
    }
};
