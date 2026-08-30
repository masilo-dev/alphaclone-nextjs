import { supabase as defaultSupabase } from '../../lib/supabase';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { encrypt, decrypt } from '../../lib/encryption';

export interface ZohoConfig {
    accessToken: string;
    refreshToken: string;
    expiryDate: string;
    mailApiHost?: string;
    crmApiHost?: string;
    campaignsApiHost?: string;
    accountsServer: string;
    accountId?: string;
    booksOrgId?: string;  // Zoho Books organization ID
    authExpiredAt?: string;
    authExpiredReason?: string;
}

export class ZohoAuthExpiredError extends Error {
    constructor(message = 'Zoho authentication expired. Please reconnect your Zoho account.') {
        super(message);
        this.name = 'ZohoAuthExpiredError';
    }
}

export class ZohoAPIError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ZohoAPIError';
    }
}

const ZOHO_CONFIG_CACHE_TTL_MS = 60_000;

export class ZohoService {
    protected userId: string;
    protected tenantId: string;
    protected encryptionSecret: string;
    private configCache: ZohoConfig | null = null;
    private configCachedAt = 0;

    constructor(userId: string, tenantId: string) {
        this.userId = userId;
        if (!tenantId?.trim()) {
            throw new Error('A workspace is required for Zoho operations.');
        }
        this.tenantId = tenantId.trim();
        const secret = ENV.ZOHO_ENCRYPTION_SECRET;
        if (!secret) {
            throw new Error(
                'ZOHO_ENCRYPTION_SECRET environment variable is not set. ' +
                'Generate one with: openssl rand -base64 24'
            );
        }
        this.encryptionSecret = secret;
    }

    protected getSupabaseClient() {
        if (typeof window === 'undefined') {
            return createSupabaseAdminClient();
        }
        return defaultSupabase;
    }

    static normalizeHost(value?: string): string | undefined {
        if (!value) return undefined;
        return value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
    }

    static normalizeAccountsServer(value?: string): string | undefined {
        if (!value) return undefined;
        const trimmed = value.trim().replace(/\/+$/g, '');
        return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    }

    protected invalidateConfigCache(): void {
        this.configCache = null;
        this.configCachedAt = 0;
    }

    /**
     * Get the stored Zoho configuration for the user
     */
    async getConfig(): Promise<ZohoConfig | null> {
        if (
            this.configCache &&
            Date.now() - this.configCachedAt < ZOHO_CONFIG_CACHE_TTL_MS
        ) {
            return this.configCache;
        }

        const supabase = this.getSupabaseClient();
        const { data, error } = await supabase
            .from('integrations')
            .select('config, enabled')
            .eq('tenant_id', this.tenantId)
            .eq('user_id', this.userId)
            .eq('type', 'zoho')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !data) return null;

        const config = data.config as any;

        try {
            if (config.refreshToken && config.refreshToken.includes(':')) {
                config.refreshToken = await decrypt(config.refreshToken, this.encryptionSecret);
            }
            if (config.accessToken && config.accessToken.includes(':')) {
                config.accessToken = await decrypt(config.accessToken, this.encryptionSecret);
            }
        } catch (e) {
            console.error('Failed to decrypt Zoho tokens:', e);
        }

        config.mailApiHost = ZohoService.normalizeHost(config.mailApiHost);
        config.crmApiHost = ZohoService.normalizeHost(config.crmApiHost);
        config.campaignsApiHost = ZohoService.normalizeHost(config.campaignsApiHost);
        config.accountsServer = ZohoService.normalizeAccountsServer(config.accountsServer) || 'https://accounts.zoho.com';

        const normalized = config as ZohoConfig;
        this.configCache = normalized;
        this.configCachedAt = Date.now();
        return normalized;
    }

    async saveConfig(config: Partial<ZohoConfig>): Promise<void> {
        this.invalidateConfigCache();
        const currentConfig = await this.getConfig() || {};
        const newConfig = { ...currentConfig, ...config };

        // Normalize host values for legacy configurations.
        newConfig.mailApiHost = ZohoService.normalizeHost(newConfig.mailApiHost);
        newConfig.crmApiHost = ZohoService.normalizeHost(newConfig.crmApiHost);
        newConfig.campaignsApiHost = ZohoService.normalizeHost(newConfig.campaignsApiHost);
        newConfig.accountsServer = ZohoService.normalizeAccountsServer(newConfig.accountsServer);

        // Encrypt tokens before saving
        if (newConfig.refreshToken && !newConfig.refreshToken.includes(':')) {
            newConfig.refreshToken = await encrypt(newConfig.refreshToken, this.encryptionSecret);
            delete newConfig.authExpiredAt;
            delete newConfig.authExpiredReason;
        }
        if (newConfig.accessToken && !newConfig.accessToken.includes(':')) {
            newConfig.accessToken = await encrypt(newConfig.accessToken, this.encryptionSecret);
        }

        const supabase = this.getSupabaseClient();
        const payload = {
            user_id: this.userId,
            type: 'zoho',
            name: 'Zoho Workspace',
            enabled: true,
            config: newConfig,
            updated_at: new Date().toISOString(),
            tenant_id: this.tenantId,
        };

        const { data: existing } = await supabase
            .from('integrations')
            .select('id')
            .eq('tenant_id', this.tenantId)
            .eq('user_id', this.userId)
            .eq('type', 'zoho')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existing?.id) {
            const { error: updateError } = await supabase
                .from('integrations')
                .update({ ...payload, enabled: true })
                .eq('id', existing.id);
            if (updateError) {
                throw new Error(`Failed to update Zoho integration config: ${updateError.message}`);
            }
            return;
        }

        const { error: insertError } = await supabase
            .from('integrations')
            .insert(payload);
        if (insertError) {
            throw new Error(`Failed to save Zoho integration config: ${insertError.message}`);
        }

        this.invalidateConfigCache();
    }

    /** Clear stale auth-expired flags after a successful token refresh or OAuth reconnect. */
    protected async clearAuthExpiredFlags(): Promise<void> {
        this.invalidateConfigCache();
        const supabase = this.getSupabaseClient();
        const { data: existing } = await supabase
            .from('integrations')
            .select('id, config')
            .eq('tenant_id', this.tenantId)
            .eq('user_id', this.userId)
            .eq('type', 'zoho')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!existing?.id) return;

        const config = { ...((existing.config as Record<string, unknown>) || {}) };
        delete config.authExpiredAt;
        delete config.authExpiredReason;

        await supabase
            .from('integrations')
            .update({
                enabled: true,
                config,
                updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        this.invalidateConfigCache();
    }

    /** Disable cron/API use when Zoho revokes the refresh token. */
    protected async markRefreshTokenRevoked(reason: string): Promise<void> {
        this.invalidateConfigCache();
        const supabase = this.getSupabaseClient();
        const { data: existing } = await supabase
            .from('integrations')
            .select('id, config')
            .eq('tenant_id', this.tenantId)
            .eq('user_id', this.userId)
            .eq('type', 'zoho')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!existing?.id) return;

        const config = (existing.config as Record<string, unknown>) || {};
        await supabase
            .from('integrations')
            .update({
                enabled: false,
                config: {
                    ...config,
                    authExpiredAt: new Date().toISOString(),
                    authExpiredReason: reason,
                },
                updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
    }

    async refreshAccessToken(): Promise<string | null> {
        const config = await this.getConfig();
        if (!config?.refreshToken) return null;

        const accountsServer = ZohoService.normalizeAccountsServer(config.accountsServer) || 'https://accounts.zoho.com';
        const clientId = ENV.ZOHO_CLIENT_ID || '';
        const clientSecret = ENV.ZOHO_CLIENT_SECRET || '';
        if (!clientId || !clientSecret) return null;

        let response: Response;
        try {
            response = await fetch(`${accountsServer}/oauth/v2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    refresh_token: config.refreshToken,
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'refresh_token',
                }),
            });
        } catch (networkErr) {
            console.error('Zoho token refresh network error:', networkErr);
            return null;
        }

        const data = await response.json();

        if (data.error) {
            const revoked = data.error === 'invalid_code' || data.error === 'invalid_grant';
            console.error('Zoho token refresh failed:', data.error);
            if (revoked) {
                await this.markRefreshTokenRevoked(String(data.error));
                throw new ZohoAuthExpiredError(
                    'Zoho refresh token is no longer valid. Reconnect Zoho in Integrations.'
                );
            }
            return null;
        }

        if (data.access_token) {
            const expiryDate = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
            await this.saveConfig({ accessToken: data.access_token, expiryDate });
            await this.clearAuthExpiredFlags();
            return data.access_token;
        }

        return null;
    }

    async getValidAccessToken(): Promise<string | null> {
        const config = await this.getConfig();
        if (!config) return null;

        const expiry = config.expiryDate ? new Date(config.expiryDate).getTime() : NaN;
        const needsRefresh =
            !config.expiryDate ||
            Number.isNaN(expiry) ||
            Date.now() > expiry - 300000;

        if (needsRefresh) {
            return await this.refreshAccessToken();
        }

        return config.accessToken;
    }

    /**
     * Make an authenticated Zoho API call.
     * Automatically retries with a fresh token on 401.
     * Throws ZohoAuthExpiredError if auth cannot be recovered.
     * Throws ZohoAPIError for 4xx/5xx responses.
     */
    protected async callZohoAPI(url: string, options: RequestInit = {}): Promise<any> {
        const makeRequest = async (token: string): Promise<Response> => {
            return fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                    Authorization: `Zoho-oauthtoken ${token}`,
                },
            });
        };

        let token = await this.getValidAccessToken();
        if (!token) {
            throw new ZohoAuthExpiredError();
        }

        let response = await makeRequest(token);

        // On 401: force a fresh token refresh and retry once
        if (response.status === 401) {
            const newToken = await this.refreshAccessToken();
            if (!newToken) {
                // Do NOT auto-disconnect — token refresh may be transiently failing.
                // Throw so the caller can show a reconnect prompt without deleting tokens.
                throw new ZohoAuthExpiredError();
            }
            response = await makeRequest(newToken);
            if (response.status === 401) {
                // Still failing after refresh — throw but keep tokens in DB.
                throw new ZohoAuthExpiredError();
            }
        }

        if (response.status === 404) {
            console.error(`[Zoho API] 404 Not Found: ${url}`);
            throw new ZohoAPIError(404, `Zoho resource not found: ${url}`);
        }

        if (!response.ok) {
            let errBody = '';
            try { errBody = await response.text(); } catch {}
            
            console.error(`[Zoho API] Error ${response.status}: ${errBody} (URL: ${url})`);
            
            // Re-parse it as JSON if it looks like it for better structured error info
            let parsedError = errBody;
            try { parsedError = JSON.parse(errBody); } catch {}
            
            throw new ZohoAPIError(response.status, `Zoho API error ${response.status}: ${errBody}`);
        }

        return response.json();
    }

    static getHostsByRegion(region: string) {
        const hosts: Record<string, { accounts: string; mail: string; crm: string; campaigns: string }> = {
            US: { accounts: 'https://accounts.zoho.com',    mail: 'mail.zoho.com',    crm: 'www.zohoapis.com',    campaigns: 'campaigns.zoho.com' },
            EU: { accounts: 'https://accounts.zoho.eu',     mail: 'mail.zoho.eu',     crm: 'www.zohoapis.eu',     campaigns: 'campaigns.zoho.eu' },
            IN: { accounts: 'https://accounts.zoho.in',     mail: 'mail.zoho.in',     crm: 'www.zohoapis.in',     campaigns: 'campaigns.zoho.in' },
            AU: { accounts: 'https://accounts.zoho.com.au', mail: 'mail.zoho.com.au', crm: 'www.zohoapis.com.au', campaigns: 'campaigns.zoho.com.au' },
            JP: { accounts: 'https://accounts.zoho.jp',     mail: 'mail.zoho.jp',     crm: 'www.zohoapis.jp',     campaigns: 'campaigns.zoho.jp' },
            CA: { accounts: 'https://accounts.zoho.ca',     mail: 'mail.zoho.ca',     crm: 'www.zohoapis.ca',     campaigns: 'campaigns.zoho.ca' },
        };
        return hosts[region] || hosts.US;
    }

    async checkIntegration(): Promise<boolean> {
        const health = await this.getDetailedHealthStatus();
        return health.status === 'connected_and_ready' || health.status === 'connected_sender_setup_required';
    }

    async getDetailedHealthStatus(): Promise<{
        status: 'connected_and_ready' | 'connected_sender_setup_required' | 'auth_expired' | 'permission_missing' | 'disconnected';
        senderConfigured: boolean;
        tokenValid: boolean;
        details: string;
    }> {
        const config = await this.getConfig();
        if (!config?.refreshToken) {
            return {
                status: 'disconnected',
                senderConfigured: false,
                tokenValid: false,
                details: 'Zoho integration is not connected.',
            };
        }

        const senderConfigured = !!(config.mailApiHost || config.crmApiHost);

        try {
            const token = await this.getValidAccessToken();
            if (!token) {
                if (config.authExpiredAt) {
                    return {
                        status: 'auth_expired',
                        senderConfigured,
                        tokenValid: false,
                        details: config.authExpiredReason || 'Zoho authentication expired. Reconnect required.',
                    };
                }
                return {
                    status: 'auth_expired',
                    senderConfigured,
                    tokenValid: false,
                    details: 'Failed to refresh Zoho access token.',
                };
            }

            await this.clearAuthExpiredFlags();

            if (!senderConfigured) {
                return {
                    status: 'connected_sender_setup_required',
                    senderConfigured: false,
                    tokenValid: true,
                    details: 'Connected, but Zoho mail/CRM host or sender email is not configured.',
                };
            }

            return {
                status: 'connected_and_ready',
                senderConfigured: true,
                tokenValid: true,
                details: 'Zoho integration is healthy, authenticated, and ready for operations.',
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Zoho API call failed during health check.';
            if (err instanceof ZohoAuthExpiredError) {
                return {
                    status: 'auth_expired',
                    senderConfigured,
                    tokenValid: false,
                    details: message,
                };
            }
            return {
                status: 'permission_missing',
                senderConfigured,
                tokenValid: false,
                details: message,
            };
        }
    }

    async disconnect(): Promise<void> {
        const supabase = this.getSupabaseClient();
        await supabase
            .from('integrations')
            .delete()
            .eq('tenant_id', this.tenantId)
            .eq('user_id', this.userId)
            .eq('type', 'zoho');
        this.invalidateConfigCache();
    }
}
