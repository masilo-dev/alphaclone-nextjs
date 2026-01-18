import { supabase } from '../lib/supabase';

export interface TwoFactorAuth {
    enabled: boolean;
    secret?: string;
    backupCodes?: string[];
}

export interface SSOProvider {
    id: string;
    name: string;
    enabled: boolean;
    config: Record<string, any>;
}

export const authSecurityService = {
    /**
     * Enable 2FA for a user
     */
    async enable2FA(userId: string): Promise<{ secret: string; qrCode: string; error: string | null }> {
        try {
            // Generate TOTP secret (in production, use a library like 'otplib')
            const secret = this.generateSecret();
            const qrCode = this.generateQRCode(userId, secret);

            // Store secret in database
            const { error } = await supabase
                .from('user_security')
                .upsert({
                    user_id: userId,
                    two_factor_enabled: true,
                    two_factor_secret: secret,
                    backup_codes: this.generateBackupCodes(),
                });

            if (error) throw error;

            return { secret, qrCode, error: null };
        } catch (error) {
            return {
                secret: '',
                qrCode: '',
                error: error instanceof Error ? error.message : 'Failed to enable 2FA',
            };
        }
    },

    /**
     * Verify 2FA code
     */
    async verify2FA(userId: string, code: string): Promise<{ valid: boolean; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('user_security')
                .select('two_factor_secret, backup_codes')
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                return { valid: false, error: '2FA not configured' };
            }

            // Verify TOTP code (in production, use 'otplib')
            const isValid = this.verifyTOTP(data.two_factor_secret, code);

            // Check backup codes if TOTP fails
            if (!isValid && data.backup_codes?.includes(code)) {
                // Remove used backup code
                const updatedCodes = data.backup_codes.filter((c: string) => c !== code);
                await supabase
                    .from('user_security')
                    .update({ backup_codes: updatedCodes })
                    .eq('user_id', userId);
                return { valid: true, error: null };
            }

            return { valid: isValid, error: null };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : '2FA verification failed',
            };
        }
    },

    /**
     * Disable 2FA
     */
    async disable2FA(userId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase
                .from('user_security')
                .update({
                    two_factor_enabled: false,
                    two_factor_secret: null,
                    backup_codes: null,
                })
                .eq('user_id', userId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to disable 2FA',
            };
        }
    },

    /**
     * Get 2FA status
     */
    async get2FAStatus(userId: string): Promise<{ enabled: boolean; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('user_security')
                .select('two_factor_enabled')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return { enabled: data?.two_factor_enabled || false, error: null };
        } catch (error) {
            return {
                enabled: false,
                error: error instanceof Error ? error.message : 'Failed to check 2FA status',
            };
        }
    },

    /**
     * Setup SSO provider
     */
    async setupSSO(provider: SSOProvider, userId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            // Store SSO configuration
            const { error } = await supabase
                .from('sso_providers')
                .insert({
                    user_id: userId,
                    provider_id: provider.id,
                    provider_name: provider.name,
                    enabled: provider.enabled,
                    config: provider.config,
                });

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to setup SSO',
            };
        }
    },

    /**
     * Authenticate via SSO
     */
    async authenticateSSO(_providerId: string, _token: string): Promise<{ user: any; error: string | null }> {
        try {
            // Verify SSO token and get user info
            // This would integrate with the actual SSO provider (Google, Microsoft, etc.)
            // For now, return a placeholder

            return {
                user: null,
                error: 'SSO authentication not fully implemented',
            };
        } catch (error) {
            return {
                user: null,
                error: error instanceof Error ? error.message : 'SSO authentication failed',
            };
        }
    },

    /**
     * Generate TOTP secret (placeholder - use proper library in production)
     */
    generateSecret(): string {
        // In production, use: import { authenticator } from 'otplib';
        // return authenticator.generateSecret();
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    },

    /**
     * Generate QR code for 2FA setup (placeholder)
     */
    generateQRCode(_userId: string, secret: string): string {
        // In production, use: import { authenticator } from 'otplib';
        // const otpauth = authenticator.keyuri(userId, 'AlphaClone Systems', secret);
        // return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`;
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${secret}`;
    },

    /**
     * Verify TOTP code (placeholder - use proper library in production)
     */
    verifyTOTP(_secret: string, code: string): boolean {
        // In production, use: import { authenticator } from 'otplib';
        // return authenticator.verify({ token: code, secret });
        return code.length === 6 && /^\d+$/.test(code);
    },

    /**
     * Generate backup codes
     */
    generateBackupCodes(): string[] {
        const codes: string[] = [];
        for (let i = 0; i < 10; i++) {
            codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
        }
        return codes;
    },

    /**
     * Get login history
     */
    async getLoginHistory(userId: string, limit: number = 20): Promise<{ history: any[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('login_history')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return { history: data || [], error: null };
        } catch (error) {
            return {
                history: [],
                error: error instanceof Error ? error.message : 'Failed to fetch login history',
            };
        }
    },

    /**
     * Log login attempt
     */
    async logLogin(userId: string, ipAddress: string, userAgent: string, success: boolean): Promise<void> {
        try {
            await supabase.from('login_history').insert({
                user_id: userId,
                ip_address: ipAddress,
                user_agent: userAgent,
                success,
                created_at: new Date().toISOString(),
            });
        } catch (error) {
            // Silently fail - logging is non-critical
        }
    },
};

