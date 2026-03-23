import { supabase } from '../../lib/supabase';
import { encrypt, decrypt } from '../../lib/encryption';

export interface ZohoConfig {
    accessToken: string;
    refreshToken: string;
    expiryDate: string;
    mailApiHost?: string;
    crmApiHost?: string;
    accountsServer: string;
    accountId?: string;
}

export class ZohoService {
    protected userId: string;
    protected encryptionSecret: string;

    constructor(userId: string) {
        this.userId = userId;
        this.encryptionSecret = process.env.ZOHO_ENCRYPTION_SECRET || 'default-32-char-secret-for-zoho-'; // Must be 32 chars
    }

    /**
     * Get the stored Zoho configuration for the user
     */
    async getConfig(): Promise<ZohoConfig | null> {
        const { data, error } = await supabase
            .from('integrations')
            .select('config')
            .eq('user_id', this.userId)
            .eq('type', 'zoho')
            .maybeSingle();

        if (error || !data) return null;
        
        const config = data.config as any;
        
        // Decrypt tokens if encrypted
        try {
            if (config.refreshToken && config.refreshToken.includes(':')) {
                config.refreshToken = decrypt(config.refreshToken, this.encryptionSecret);
            }
            if (config.accessToken && config.accessToken.includes(':')) {
                config.accessToken = decrypt(config.accessToken, this.encryptionSecret);
            }
        } catch (e) {
            console.error('Failed to decrypt Zoho tokens:', e);
        }

        return config as ZohoConfig;
    }

    /**
     * Save/Update Zoho configuration
     */
    async saveConfig(config: Partial<ZohoConfig>): Promise<void> {
        const currentConfig = await this.getConfig() || {};
        const newConfig = { ...currentConfig, ...config };

        // Encrypt tokens before saving
        if (newConfig.refreshToken && !newConfig.refreshToken.includes(':')) {
            newConfig.refreshToken = encrypt(newConfig.refreshToken, this.encryptionSecret);
        }
        if (newConfig.accessToken && !newConfig.accessToken.includes(':')) {
            newConfig.accessToken = encrypt(newConfig.accessToken, this.encryptionSecret);
        }

        await supabase
            .from('integrations')
            .upsert({
                user_id: this.userId,
                type: 'zoho',
                name: 'Zoho Workspace',
                enabled: true,
                config: newConfig,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,type'
            });
    }

    /**
     * Refresh the access token using the refresh token
     */
    async refreshAccessToken(): Promise<string | null> {
        const config = await this.getConfig();
        if (!config || !config.refreshToken) return null;

        const response = await fetch(`${config.accountsServer}/oauth/v2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                refresh_token: config.refreshToken,
                client_id: process.env.ZOHO_CLIENT_ID || '',
                client_secret: process.env.ZOHO_CLIENT_SECRET || '',
                grant_type: 'refresh_token',
            }),
        });

        const data = await response.json();
        if (data.access_token) {
            const expiryDate = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
            await this.saveConfig({
                accessToken: data.access_token,
                expiryDate
            });
            return data.access_token;
        }

        return null;
    }

    /**
     * Get a valid access token (refreshes if needed)
     */
    async getValidAccessToken(): Promise<string | null> {
        const config = await this.getConfig();
        if (!config) return null;

        const expiry = new Date(config.expiryDate).getTime();
        // Refresh if expiring in less than 5 minutes
        if (Date.now() > expiry - 300000) {
            return await this.refreshAccessToken();
        }

        return config.accessToken;
    }

    /**
     * Helper to resolve Zoho API hosts based on the region
     */
    static getHostsByRegion(region: string) {
        const hosts: Record<string, { accounts: string; mail: string; crm: string }> = {
            US: { accounts: 'https://accounts.zoho.com', mail: 'mail.zoho.com', crm: 'www.zohoapis.com' },
            EU: { accounts: 'https://accounts.zoho.eu', mail: 'mail.zoho.eu', crm: 'www.zohoapis.eu' },
            IN: { accounts: 'https://accounts.zoho.in', mail: 'mail.zoho.in', crm: 'www.zohoapis.in' },
            AU: { accounts: 'https://accounts.zoho.com.au', mail: 'mail.zoho.com.au', crm: 'www.zohoapis.com.au' },
            JP: { accounts: 'https://accounts.zoho.jp', mail: 'mail.zoho.jp', crm: 'www.zohoapis.jp' },
            CA: { accounts: 'https://accounts.zoho.ca', mail: 'mail.zoho.ca', crm: 'www.zohoapis.ca' },
        };
        return hosts[region] || hosts.US;
    }
}
