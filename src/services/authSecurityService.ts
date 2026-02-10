import { supabase } from '../lib/supabase';
import { TOTP } from 'otplib';
import QRCode from 'qrcode';

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
    async enable2FA(userId: string, userEmail: string): Promise<{ secret: string; qrCode: string; backupCodes: string[]; error: string | null }> {
        try {
            // Generate TOTP secret using otplib
            const secret = this.generateSecret();
            const qrCode = await this.generateQRCode(userEmail, secret);
            const backupCodes = this.generateBackupCodes();

            // Store secret in database
            const { error } = await supabase
                .from('user_security')
                .upsert({
                    user_id: userId,
                    two_factor_enabled: true,
                    two_factor_secret: secret,
                    backup_codes: backupCodes,
                    updated_at: new Date().toISOString(),
                });

            if (error) throw error;

            return { secret, qrCode, backupCodes, error: null };
        } catch (error) {
            return {
                secret: '',
                qrCode: '',
                backupCodes: [],
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
            const isValid = await this.verifyTOTP(data.two_factor_secret, code);

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
     * Generate TOTP secret using otplib
     */
    generateSecret(): string {
        const totp = new TOTP();
        return totp.generateSecret();
    },

    /**
     * Generate QR code for 2FA setup
     */
    async generateQRCode(userEmail: string, secret: string): Promise<string> {
        try {
            // Generate otpauth URL for authenticator apps
            const totp = new TOTP({
                secret,
                issuer: 'AlphaClone Business OS',
                label: userEmail,
            });
            const otpauth = totp.toURI();

            // Generate QR code as data URL
            const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

            return qrCodeDataUrl;
        } catch (error) {
            console.error('Error generating QR code:', error);
            throw new Error('Failed to generate QR code');
        }
    },

    /**
     * Verify TOTP code using otplib
     */
    async verifyTOTP(secret: string, code: string): Promise<boolean> {
        try {
            // Allow a 30-second window for time drift tolerance
            const totp = new TOTP({ secret });
            const result = await totp.verify(code);
            return result.valid;
        } catch (error) {
            console.error('Error verifying TOTP:', error);
            return false;
        }
    },

    /**
     * Generate cryptographically secure backup codes
     */
    generateBackupCodes(): string[] {
        const codes: string[] = [];
        for (let i = 0; i < 10; i++) {
            // Generate 8-character alphanumeric codes using crypto
            const randomBytes = new Uint8Array(6);
            if (typeof window !== 'undefined') {
                window.crypto.getRandomValues(randomBytes);
            } else {
                // For Node.js environment
                const crypto = require('crypto');
                crypto.randomFillSync(randomBytes);
            }
            const code = Array.from(randomBytes)
                .map(byte => byte.toString(36).toUpperCase())
                .join('')
                .substring(0, 8)
                .padEnd(8, '0');
            codes.push(code);
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

