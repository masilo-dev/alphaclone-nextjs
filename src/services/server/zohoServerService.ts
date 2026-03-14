import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';

export const zohoServerService = {
    /**
     * Get valid access token (refreshes if needed)
     */
    async getValidToken(userId: string): Promise<string | null> {
        try {
            const supabaseAdmin = createSupabaseAdminClient();
            const { data: integration, error } = await supabaseAdmin
                .from('integrations')
                .select('*')
                .eq('user_id', userId)
                .eq('type', 'zoho')
                .maybeSingle();

            if (error) {
                console.error('[Zoho Token Debug] Supabase error fetching integration:', error);
                return null;
            }
            if (!integration) {
                console.error('[Zoho Token Debug] No Zoho integration found for user:', userId);
                return null;
            }
            if (!integration.config) {
                console.error('[Zoho Token Debug] Integration found but config object is missing:', integration.id);
                return null;
            }

            const config = integration.config;
            if (!config.expiryDate) {
                console.error('[Zoho Token Debug] Config missing expiryDate:', config);
                return null;
            }

            const expiresAt = new Date(config.expiryDate).getTime();

            if (Date.now() < expiresAt - 60000) { // If it expires in more than a minute
                return config.accessToken;
            }

            console.log('[Zoho Token Debug] Token expired, attempting refresh for integration:', integration.id);
            // Refresh token
            return await this.refreshToken(userId, config.refreshToken, integration.id);
        } catch (err) {
            console.error('[Zoho Token Debug] Unexpected error in getValidToken:', err);
            return null;
        }
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

            let accountsServer = currentIntegration?.config?.accountsServer;
            const mailApiHost = currentIntegration?.config?.mailApiHost || 'mail.zoho.com';

            // If accountsServer is missing, derive it from mailApiHost (e.g. mail.zoho.eu -> accounts.zoho.eu)
            if (!accountsServer) {
                if (mailApiHost.includes('.eu')) accountsServer = 'https://accounts.zoho.eu';
                else if (mailApiHost.includes('.in')) accountsServer = 'https://accounts.zoho.in';
                else if (mailApiHost.includes('.com.au')) accountsServer = 'https://accounts.zoho.com.au';
                else if (mailApiHost.includes('.jp')) accountsServer = 'https://accounts.zoho.jp';
                else if (mailApiHost.includes('.ca')) accountsServer = 'https://accounts.zoho.ca';
                else accountsServer = 'https://accounts.zoho.com';
            }

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
            if (data.error) {
                console.error('[Zoho Refresh Error]', JSON.stringify(data));
                throw new Error(data.error);
            }

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
    async proxyRequest(userId: string, endpoint: string, options: RequestInit = {}): Promise<any> {
        const token = await this.getValidToken(userId);
        if (!token) throw new Error('Zoho not connected: Valid token could not be retrieved');

        // Need accountId for most requests. We should store it in config.
        const supabaseAdmin = createSupabaseAdminClient();
        const { data: integration, error } = await supabaseAdmin
            .from('integrations')
            .select('config')
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .single();

        if (error) {
            console.error('[Zoho Proxy Debug] Failed to fetch integration for proxyRequest:', error);
            throw new Error('Database error fetching Zoho integration info');
        }

        const accountId = integration?.config?.accountId || integration?.config?.zoid;
        if (!accountId && !endpoint.includes('accounts')) {
            console.error('[Zoho Proxy Debug] Account ID is missing in integration config:', integration.config);
            // Try to auto-resolve accountId if it's missing but we have a token
            try {
                const accountsData = await this.proxyRequest(userId, 'accounts');
                if (accountsData.data && accountsData.data.length > 0) {
                    const resolvedId = accountsData.data[0].accountId;
                    console.log('[Zoho Proxy Debug] Auto-resolved accountId:', resolvedId);
                    return this.proxyRequest(userId, endpoint, options);
                }
            } catch (e) {
                console.error('[Zoho Proxy Debug] Auto-resolve failed:', e);
            }
            throw new Error('Zoho account ID not found in database settings');
        }

        const mailApiHost = integration?.config?.mailApiHost || 'mail.zoho.com';
        const baseUrl = `https://${mailApiHost}/api`; // Base URL should be /api, account ID comes after /accounts
        
        // Correctly construct the URL:
        // 1. If absolute URL, use it
        // 2. If 'accounts', it's always https://{host}/api/accounts
        // 3. Otherwise, it's https://{host}/api/accounts/{accountId}/{endpoint}
        const url = endpoint.startsWith('http')
            ? endpoint
            : endpoint === 'accounts'
                ? `${baseUrl}/accounts`
                : `${baseUrl}/accounts/${accountId}/${endpoint}`;

        console.log(`[Zoho Proxy Debug] Sending request to URL: ${url}`);

        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Zoho-oauthtoken ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Zoho Proxy Debug] Request to ${url} failed with status ${response.status} (${response.statusText}):`, errorText);

            let description = `Zoho API Error ${response.status} (${response.statusText}): ${errorText.substring(0, 150)}`;
            try {
                const errorJson = JSON.parse(errorText);
                description = errorJson.status?.description || errorJson.error_message || errorJson.error || description;
            } catch (e) {
            }
            throw new Error(description);
        }

        return await response.json();
    },

    /**
     * Extract clean email address from "Name <email@domain.com>" format
     */
    extractEmail(address: any): string {
        if (!address || typeof address !== 'string') return '';
        const match = address.match(/<([^>]+)>/);
        if (match) return match[1].trim();
        return address.trim();
    },

    /**
     * Send email via Zoho Mail API
     */
    async sendMessage(userId: string, data: {
        toAddress: string;
        subject: string;
        content: string;
        fromAddress?: string;
    }) {
        const supabaseAdmin = createSupabaseAdminClient();
        let fromAddress = data.fromAddress;
        
        // 1. Actively try to get valid 'fromAddresses' to avoid 'Given FromAddress not exists!'
        try {
            const accountsData = await this.proxyRequest(userId, 'accounts');
            if (accountsData.data && accountsData.data.length > 0) {
                const acctId = accountsData.data[0].accountId;
                let validAddresses: any[] = [];
                try {
                    const sendAddrReq = await this.proxyRequest(userId, 'sendaddresses');
                    if (sendAddrReq.data && sendAddrReq.data.length > 0) {
                        validAddresses = sendAddrReq.data;
                    }
                } catch {
                    // Fallback to sendAddress inside account if sendaddresses API fails
                    if (accountsData.data[0].sendAddress && accountsData.data[0].sendAddress.length > 0) {
                        validAddresses = accountsData.data[0].sendAddress;
                    }
                }

                if (validAddresses.length > 0) {
                    if (fromAddress) {
                        const cleanProvided = this.extractEmail(fromAddress).toLowerCase();
                        const isValid = validAddresses.some(a => this.extractEmail(a.sendAddress || a.fromAddress || a.address || a.emailAddress).toLowerCase() === cleanProvided);
                        if (!isValid) {
                            console.warn(`[Zoho Send Debug] Provided fromAddress ${fromAddress} is not verified. Using default.`);
                            const defaultAddr = validAddresses.find(a => a.isDefault) || validAddresses[0];
                            fromAddress = defaultAddr.sendAddress || defaultAddr.fromAddress || defaultAddr.address || defaultAddr.emailAddress;
                        }
                    } else {
                        const defaultAddr = validAddresses.find(a => a.isDefault) || validAddresses[0];
                        fromAddress = defaultAddr.sendAddress || defaultAddr.fromAddress || defaultAddr.address || defaultAddr.emailAddress;
                    }
                } else if (!fromAddress) {
                    // Fallback to primary account email if no validAddresses and no fromAddress 
                    fromAddress = accountsData.data[0].emailAddress || accountsData.data[0].primaryEmail;
                }
            }
        } catch (e) {
            console.error('[Zoho Send Debug] Verified custom fetch failed, falling back to DB/params', e);
        }

        if (!fromAddress) {
            const { data: integration, error } = await supabaseAdmin
                .from('integrations')
                .select('config')
                .eq('user_id', userId)
                .eq('type', 'zoho')
                .single();

            if (error || !integration?.config?.email) {
                console.error('[Zoho Send Debug] Failed to fetch sender email from config:', error || 'Missing email');
                throw new Error('Zoho integration is missing email address configuration');
            }
            fromAddress = integration.config.email;
        }

        // Sanitize addresses to ensure they match Zoho's expected patterns
        const cleanTo = this.extractEmail(data.toAddress);
        const cleanFrom = this.extractEmail(fromAddress!);

        console.log(`[Zoho Send Debug] Sending email: From ${cleanFrom} To ${cleanTo}`);

        return this.proxyRequest(userId, 'messages', {
            method: 'POST',
            body: JSON.stringify({
                fromAddress: cleanFrom,
                toAddress: cleanTo,
                subject: data.subject,
                content: data.content,
                mailFormat: 'html'
            }),
        });
    }
};
