import { supabase } from '@/lib/supabase';
import { ENV } from '@/config/env';

export const googleDriveService = {
    async getTokens(userId: string) {
        // We reuse the google_calendar_tokens table or create a new one?
        // Let's assume we use a generic google_tokens table if it exists, 
        // but based on googleCalendarService, it uses google_calendar_tokens.
        // For now, let's use a similar pattern or check for a generic table.

        const { data, error } = await supabase
            .from('google_tokens') // Assuming a more generic table for all Google services
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !data) {
            // Fallback to calendar tokens if generic doesn't exist (legacy)
            const { data: calData } = await supabase
                .from('google_calendar_tokens')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (!calData) return null;
            return calData;
        }

        // Check if token is expired (giving 5 min buffer)
        const expiresAt = new Date(data.expires_at);
        if (Date.now() + 5 * 60 * 1000 > expiresAt.getTime()) {
            return await this.refreshTokens(userId, data.refresh_token);
        }

        return data;
    },

    async refreshTokens(userId: string, refreshToken: string) {
        if (!refreshToken) return null;

        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: ENV.GOOGLE_CLIENT_ID!,
                    client_secret: ENV.GOOGLE_CLIENT_SECRET!,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                }),
            });

            const tokens = await response.json();
            if (tokens.error) throw new Error(tokens.error);

            const { access_token, expires_in } = tokens;
            const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

            // Try to update both potential tables
            await supabase
                .from('google_tokens')
                .update({ access_token, expires_at: expiresAt })
                .eq('user_id', userId);

            const { data, error } = await supabase
                .from('google_calendar_tokens')
                .update({ access_token, expires_at: expiresAt })
                .eq('user_id', userId)
                .select('*')
                .single();

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Failed to refresh Google tokens:', err);
            return null;
        }
    },

    async uploadFile(userId: string, blob: Blob, filename: string) {
        const tokens = await this.getTokens(userId);
        if (!tokens) throw new Error('Not connected to Google Drive. Please connect your Google account in Settings.');

        try {
            const metadata = {
                name: filename,
                mimeType: blob.type,
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                },
                body: form,
            });

            if (!response.ok) {
                const err = await response.json();
                if (response.status === 403) {
                    throw new Error('Insufficient permissions. Please reconnect your Google account with Drive access.');
                }
                throw new Error(err.error?.message || 'Failed to upload to Google Drive');
            }

            return await response.json();
        } catch (err: any) {
            console.error('Google Drive Upload Error:', err);
            throw err;
        }
    }
};

export default googleDriveService;
