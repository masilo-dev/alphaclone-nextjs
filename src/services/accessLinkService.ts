import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { ENV } from '@/config/env';

export type AccessTokenType = 'welcome' | 'login' | 'invite';

export const accessLinkService = {
    /**
     * Creates a secure access token and returns the full gatekeeper URL
     */
    async createAccessLink(
        supabase: SupabaseClient,
        userId: string,
        type: AccessTokenType = 'welcome'
    ): Promise<{ link: string; token: string; expiresAt: Date }> {
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

        const { error } = await supabase
            .from('access_tokens')
            .insert({
                user_id: userId,
                token,
                type,
                expires_at: expiresAt.toISOString(),
            });

        if (error) {
            console.error('[accessLinkService] Failed to create token:', error);
            throw new Error('Failed to generate secure access token');
        }

        const baseUrl = ENV.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
        const link = `${baseUrl}/auth/welcome-gate?token=${token}`;

        return { link, token, expiresAt };
    },

    /**
     * Verifies a token and returns the user_id if valid
     */
    async verifyToken(
        supabase: SupabaseClient,
        token: string
    ): Promise<{ userId: string | null; error: string | null }> {
        const { data, error } = await supabase
            .from('access_tokens')
            .select('user_id, expires_at, used_at')
            .eq('token', token)
            .maybeSingle();

        if (error || !data) {
            return { userId: null, error: 'Invalid or missing security token' };
        }

        if (data.used_at) {
            return { userId: null, error: 'This access link has already been used' };
        }

        if (new Date(data.expires_at) < new Date()) {
            return { userId: null, error: 'This access link has expired (30-minute limit exceeded)' };
        }

        // Mark as used
        await supabase
            .from('access_tokens')
            .update({ used_at: new Date().toISOString() })
            .eq('token', token);

        return { userId: data.user_id, error: null };
    }
};
