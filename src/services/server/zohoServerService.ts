import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';
import { encrypt, decrypt } from '@/lib/encryption';

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
                console.error(`[Zoho Token Debug] Supabase error fetching integration for ${userId}:`, error);
                return null;
            }
            if (!integration) {
                console.warn(`[Zoho Token Debug] No Zoho integration record found in database for user ${userId}. This will trigger 'Not Connected' UI.`);
                return null;
            }
            if (!integration.config) {
                console.error(`[Zoho Token Debug] Integration found (ID: ${integration.id}) but config object is missing for user ${userId}`);
                return null;
            }

            const config = integration.config;
            const secret = ENV.ENCRYPTION_SECRET;
            
            // Decrypt accessToken if secret is available
            let accessToken = config.accessToken;
            if (secret && accessToken && accessToken.includes(':')) {
                try {
                    accessToken = decrypt(accessToken, secret);
                } catch (e) {
                    console.error('[Zoho Token Debug] Failed to decrypt accessToken:', e);
                }
            }

            if (!config.expiryDate) {
                console.error('[Zoho Token Debug] Config missing expiryDate:', config);
                return null;
            }

            const expiresAt = new Date(config.expiryDate).getTime();

            if (Date.now() < expiresAt - 60000) { // If it expires in more than a minute
                return accessToken;
            }

            console.log('[Zoho Token Debug] Token expired, attempting refresh for integration:', integration.id);
            
            // Decrypt refreshToken
            let refreshToken = config.refreshToken;
            if (secret && refreshToken && refreshToken.includes(':')) {
                try {
                    refreshToken = decrypt(refreshToken, secret);
                } catch (e) {
                    console.error('[Zoho Token Debug] Failed to decrypt refreshToken:', e);
                }
            }

            // Refresh token
            return await this.refreshToken(userId, refreshToken, integration.id);
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
            let mailApiHost = currentIntegration?.config?.mailApiHost;

            // Robust derivation of hosts based on region if missing
            if (!accountsServer || !mailApiHost) {
                const region = currentIntegration?.config?.region || 'com';
                if (!accountsServer) {
                    accountsServer = region === 'com' ? 'https://accounts.zoho.com' : `https://accounts.zoho.${region}`;
                }
                if (!mailApiHost) {
                    mailApiHost = region === 'com' ? 'mail.zoho.com' : `mail.zoho.${region}`;
                }
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
                
                // If the error is 'invalid_grant', it usually means the refresh token is revoked or expired
                if (data.error === 'invalid_grant' || data.error === 'access_denied') {
                    console.warn(`[Zoho Refresh] Access revoked for user ${userId}. Disabling integration.`);
                    await supabaseAdmin
                        .from('integrations')
                        .update({ 
                            enabled: false,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', integrationId);
                }
                
                throw new Error(data.error);
            }

            const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
            const secret = ENV.ENCRYPTION_SECRET;

            let accessToken = data.access_token;
            if (secret) {
                accessToken = encrypt(accessToken, secret);
            }

            const updatedConfig = {
                ...(currentIntegration?.config || {}),
                accessToken: accessToken,
                expiryDate: expiresAt,
            };

            await supabaseAdmin
                .from('integrations')
                .update({ config: updatedConfig })
                .eq('id', integrationId);

            return data.access_token;
        } catch (err: any) {
            console.error('Failed to refresh Zoho token:', err.message || err);
            throw err; // Re-throw to inform parent calls
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
            .maybeSingle();

        if (error || !integration) {
            console.error('[Zoho Proxy Debug] Failed to fetch integration for proxyRequest:', error);
            const err: any = new Error('Database error fetching Zoho integration info');
            err.code = 'NOT_FOUND';
            throw err;
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
        
        // Correctly construct the URL using hybrid versioning:
        // 1. If absolute URL, use it as is
        // 2. If endpoint is exactly 'accounts', use v1: https://{host}/api/accounts
        // 3. Otherwise, use v2: https://{host}/api/v2/accounts/{accountId}/{endpoint}
        
        let url = '';
        if (endpoint.startsWith('http')) {
            url = endpoint;
        } else if (endpoint === 'accounts') {
            url = `https://${mailApiHost}/api/accounts`; // Root accounts list
        } else if (endpoint.startsWith('v2/')) {
            // Support explicit v2 paths: v2/messages -> /api/v2/accounts/{id}/messages
            const v2Path = endpoint.substring(3);
            url = `https://${mailApiHost}/api/v2/accounts/${accountId}/${v2Path}`;
        } else {
            // Standard V1 path: https://{host}/api/accounts/{accountId}/{endpoint}
            url = `https://${mailApiHost}/api/accounts/${accountId}/${endpoint}`; 
        }

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
            
            // Auto-fallback to V2 for 404s on certain known paths if we are in V1
            if (response.status === 404 && !endpoint.includes('v2/') && !endpoint.startsWith('http') && endpoint !== 'accounts') {
                console.log(`[Zoho Proxy] 404 on ${endpoint}, attempting V2 fallback...`);
                return this.proxyRequest(userId, `v2/${endpoint}`, options);
            }

            console.error(`[Zoho Proxy Error] Request to ${url} failed! Status: ${response.status} (${response.statusText}). Endpoint: ${endpoint}. Trace: ${errorText.substring(0, 500)}`);

            let description = `Zoho API Error ${response.status} (${response.statusText}): ${errorText.substring(0, 150)}`;
            try {
                const errorJson = JSON.parse(errorText);
                description = errorJson.status?.description || errorJson.error_message || errorJson.error || description;
            } catch (e) {
            }
            const err: any = new Error(description);
            err.status = response.status;
            throw err;
        }

        return await response.json();
    },

    /**
     * Extract clean email address from "Name <email@domain.com>" format
     */
    extractEmail(address: any): string {
        if (!address) return '';
        
        let addressStr = '';
        if (typeof address === 'string') {
            addressStr = address;
        } else if (typeof address === 'object') {
            addressStr = address.mailId || address.address || address.emailAddress || '';
        }

        if (!addressStr) return '';
        
        const match = addressStr.match(/<([^>]+)>/);
        if (match) return match[1].trim();
        return addressStr.trim();
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
        
        // Only fetch/verify address from Zoho if not already provided
        if (!fromAddress) {
            try {
                const accountsData = await this.proxyRequest(userId, 'accounts');
                if (accountsData.data && accountsData.data.length > 0) {
                    let validAddresses: any[] = [];
                    try {
                        const sendAddrReq = await this.proxyRequest(userId, 'sendmailaddresses');
                        if (sendAddrReq.data && sendAddrReq.data.length > 0) {
                            validAddresses = sendAddrReq.data;
                        }
                    } catch (sendAddrErr) {
                        if (accountsData.data[0].sendAddress?.length > 0) {
                            validAddresses = accountsData.data[0].sendAddress;
                        }
                    }

                    if (validAddresses.length > 0) {
                        const defaultAddr = validAddresses.find((a: any) => a.isDefault) || validAddresses[0];
                        fromAddress = defaultAddr.sendAddress || defaultAddr.fromAddress || defaultAddr.address || defaultAddr.emailAddress;
                    } else {
                        fromAddress = accountsData.data[0].emailAddress || accountsData.data[0].primaryEmail;
                    }
                }
            } catch (e) {
                console.error('[Zoho Send Debug] Failed to auto-resolve fromAddress:', e);
            }
        }

        // Final fallback: read from DB config
        if (!fromAddress) {
            const { data: integration, error } = await supabaseAdmin
                .from('integrations')
                .select('config')
                .eq('user_id', userId)
                .eq('type', 'zoho')
                .maybeSingle();

            if (error || !integration?.config?.email) {
                throw new Error('Zoho integration is missing email address configuration');
            }
            fromAddress = integration.config.email;
        }

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
    },

    /**
     * Delete a message (move to trash or permanent)
     */
    async deleteMessage(userId: string, messageId: string) {
        return this.proxyRequest(userId, `messages/${messageId}`, {
            method: 'DELETE'
        });
    },

    /**
     * Move messages to a specific folder
     */
    async moveMessages(userId: string, messageIds: string[], targetFolderId: string) {
        return this.proxyRequest(userId, 'messages', {
            method: 'PUT',
            body: JSON.stringify({
                folderId: targetFolderId,
                messageIds: messageIds
            }),
        });
    }
};
