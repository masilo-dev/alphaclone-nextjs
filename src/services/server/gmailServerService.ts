import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';

export const gmailServerService = {
    /**
     * Get valid access token (refreshes if needed)
     */
    async getValidToken(userId: string): Promise<string | null> {
        const supabaseAdmin = createSupabaseAdminClient();
        const { data: tokenData, error } = await supabaseAdmin
            .from('gmail_sync_tokens')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !tokenData) return null;

        const expiresAt = new Date(tokenData.expires_at).getTime();
        if (Date.now() < expiresAt - 60000) { // If it expires in more than a minute
            return tokenData.access_token;
        }

        // Refresh token
        return await this.refreshToken(userId, tokenData.refresh_token);
    },

    /**
     * Refresh Google OAuth Token
     */
    async refreshToken(userId: string, refreshToken: string): Promise<string | null> {
        try {
            const clientId = ENV.GOOGLE_CLIENT_ID;
            const clientSecret = ENV.GOOGLE_CLIENT_SECRET;

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    refresh_token: refreshToken,
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'refresh_token',
                }),
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            // Safety guard for expires_in to prevent NaN date crashes
            const secondsToExpiry = typeof data.expires_in === 'number' ? data.expires_in : parseInt(data.expires_in) || 3600;
            const expiresAt = new Date(Date.now() + secondsToExpiry * 1000).toISOString();

            const supabaseAdmin = createSupabaseAdminClient();
            await supabaseAdmin
                .from('gmail_sync_tokens')
                .update({
                    access_token: data.access_token,
                    expires_at: expiresAt,
                })
                .eq('user_id', userId);

            return data.access_token;
        } catch (err) {
            console.error('Failed to refresh Gmail token:', err);
            return null;
        }
    },

    /**
     * Proxy request to Gmail API
     */
    async proxyRequest(userId: string, endpoint: string, options: RequestInit = {}) {
        const token = await this.getValidToken(userId);
        if (!token) throw new Error('Gmail not connected');

        const url = endpoint.startsWith('http') ? endpoint : `https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Gmail API request failed');
        }

        return await response.json();
    }
};
