import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';
import { encrypt, decrypt } from '@/lib/encryption';

/**
 * Checks if a token string is in the encrypted format: iv:authTag:encrypted (all hex parts).
 * Zoho JWTs contain dots and are NOT in this format.
 */
function isEncryptedFormat(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split(':');
    if (parts.length !== 3) return false;
    return parts.every(p => p.length > 0 && /^[0-9a-f]+$/i.test(p));
}

/**
 * Safely decrypts a token. Falls back to returning plaintext if:
 * - No secret is set
 * - Token is not in encrypted format
 * - Decryption fails (e.g. tokens saved before encryption was configured)
 */
function safeDecrypt(token: string | null | undefined, secret: string | undefined): string | null {
    if (!token) return null;
    if (!secret || !isEncryptedFormat(token)) return token; // plaintext token or no secret
    try {
        return decrypt(token, secret);
    } catch (e) {
        console.warn('[Zoho Token] Decryption failed, using token as plaintext. It may need to be re-saved.', e);
        return token; // fall back to plaintext so connection is not broken
    }
}

/**
 * Derives the correct Zoho accounts and mail hosts based on the region string.
 * Supports: com, eu, in, au, cn, jp
 */
function deriveRegionalHosts(region: string = 'com') {
    const r = region.toLowerCase();
    const accountsServer = r === 'cn' ? 'https://accounts.zoho.com.cn' : 
                          r === 'eu' ? 'https://accounts.zoho.eu' :
                          r === 'in' ? 'https://accounts.zoho.in' :
                          r === 'au' ? 'https://accounts.zoho.com.au' :
                          r === 'jp' ? 'https://accounts.zoho.jp' :
                          'https://accounts.zoho.com';

    const mailApiHost = r === 'cn' ? 'mail.zoho.com.cn' :
                       r === 'eu' ? 'mail.zoho.eu' :
                       r === 'in' ? 'mail.zoho.in' :
                       r === 'au' ? 'mail.zoho.com.au' :
                       r === 'jp' ? 'mail.zoho.jp' :
                       'mail.zoho.com';

    return { accountsServer, mailApiHost };
}

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
            
            // safeDecrypt handles both plaintext and encrypted tokens gracefully
            const accessToken = safeDecrypt(config.accessToken, secret);

            if (!config.expiryDate) {
                console.error('[Zoho Token Debug] Config missing expiryDate:', config);
                return null;
            }

            const expiresAt = new Date(config.expiryDate).getTime();

            if (Date.now() < expiresAt - 60000) { // If it expires in more than a minute
                return accessToken;
            }

            console.log('[Zoho Token Debug] Token expired, attempting refresh for integration:', integration.id);
            
            // safeDecrypt handles both plaintext and encrypted refresh tokens
            const refreshToken = safeDecrypt(config.refreshToken, secret);

            if (!refreshToken) {
                console.error('[Zoho Token Debug] No refresh token available, cannot refresh access token.');
                return null;
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

            const currentIntegration = (await supabaseAdmin
                .from('integrations')
                .select('config')
                .eq('id', integrationId)
                .single()).data;

            // Validate that accountsServer is a real URL
            const isValidUrl = (url: any): boolean => {
                if (!url || typeof url !== 'string') return false;
                try { new URL(url); return true; } catch { return false; }
            };

            let accountsServer = currentIntegration?.config?.accountsServer;
            let mailApiHost = currentIntegration?.config?.mailApiHost;

            // Robust derivation of hosts based on region if missing or invalid
            const region = currentIntegration?.config?.region || 'com';
            const derived = deriveRegionalHosts(region);

            if (!isValidUrl(accountsServer)) {
                accountsServer = derived.accountsServer;
                console.warn(`[Zoho Refresh] accountsServer was invalid, derived from region "${region}": ${accountsServer}`);
            }

            if (!mailApiHost || typeof mailApiHost !== 'string' || mailApiHost.startsWith('[')) {
                mailApiHost = derived.mailApiHost;
            }

            // Ensure mailApiHost is a clean domain
            if (mailApiHost.startsWith('http')) {
                try { mailApiHost = new URL(mailApiHost).host; } catch {}
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

        const supabaseAdmin = createSupabaseAdminClient();
        const { data: integration, error } = await supabaseAdmin
            .from('integrations')
            .select('config')
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .maybeSingle();

        if (error || !integration) {
            throw new Error('Database error fetching Zoho integration info');
        }

        let accountId = integration?.config?.accountId || integration?.config?.zoid;

        // ✅ Fix 1: Auto-resolve AND SAVE accountId if missing
        if (!accountId && !endpoint.includes('accounts')) {
            console.log('[Zoho Proxy] accountId missing, auto-resolving...');
            const accountsData = await this.proxyRequest(userId, 'accounts');
            if (!accountsData.data?.length) throw new Error('No Zoho accounts found');
            
            accountId = accountsData.data[0].accountId;

            // Save it so we don't repeat this every request
            await supabaseAdmin
                .from('integrations')
                .update({ config: { ...integration.config, accountId, zoid: accountId } })
                .eq('user_id', userId)
                .eq('type', 'zoho');

            console.log('[Zoho Proxy] Saved resolved accountId:', accountId);
        }

        // ✅ Fix 2: Dynamically derive hosts instead of hardcoding .eu
        const region = integration?.config?.region || 'com';
        const derived = deriveRegionalHosts(region);
        
        let mailApiHost = integration?.config?.mailApiHost;
        let accountsServer = integration?.config?.accountsServer;

        // Force correction if there is a mismatch detected or hosts are missing/invalid
        const needsCorrection = !mailApiHost || 
                               !accountsServer || 
                               (region === 'com' && mailApiHost.includes('.eu')) ||
                               (region === 'eu' && mailApiHost.includes('.com'));

        if (needsCorrection) {
            console.warn(`[Zoho Proxy] Regional mismatch detected for user ${userId} (Region: ${region}). Correcting hosts...`);
            mailApiHost = derived.mailApiHost;
            accountsServer = derived.accountsServer;

            // Self-healing: Update DB so we don't repeat this check
            await supabaseAdmin
                .from('integrations')
                .update({ 
                    config: { 
                        ...(integration.config || {}), 
                        mailApiHost, 
                        accountsServer 
                    } 
                })
                .eq('user_id', userId)
                .eq('type', 'zoho');
        }

        // ✅ Fix 3: Remove v2 routing entirely — Zoho EU and US V1 is often more stable for these endpoints
        let url = '';
        if (endpoint.startsWith('http')) {
            url = endpoint;
        } else if (endpoint === 'accounts') {
            url = `https://${mailApiHost}/api/accounts`;
        } else {
            // Always use V1: /api/accounts/{accountId}/{endpoint}
            url = `https://${mailApiHost}/api/accounts/${accountId}/${endpoint}`;
        }

        console.log(`[Zoho Proxy] → ${url}`);

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
            console.error(`[Zoho Proxy Error] ${url} → ${response.status}: ${errorText.substring(0, 500)}`);

            let description = `Zoho API Error ${response.status}: ${errorText.substring(0, 150)}`;
            try {
                const errorJson = JSON.parse(errorText);
                description = errorJson.status?.description || errorJson.error_message || errorJson.error || description;
            } catch (e) {}

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
    },

    /**
     * Create a Lead in Zoho CRM
     * Note: Requires ZohoCRM.modules.ALL scope
     */
    async createCRMLead(userId: string, leadData: any) {
        const token = await this.getValidToken(userId);
        if (!token) throw new Error('Zoho token not found');

        const supabaseAdmin = createSupabaseAdminClient();
        const { data: integration } = await supabaseAdmin
            .from('integrations')
            .select('config')
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .maybeSingle();
        
        const region = integration?.config?.region || 'com';
        // Map region to CRM API host
        const crmHost = region === 'cn' ? 'www.zohoapis.com.cn' : 
                       region === 'eu' ? 'www.zohoapis.eu' :
                       region === 'in' ? 'www.zohoapis.in' :
                       region === 'au' ? 'www.zohoapis.com.au' :
                       'www.zohoapis.com';
        
        const url = `https://${crmHost}/crm/v2/Leads`;
        
        console.log(`[Zoho CRM] Creating lead at ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Zoho-oauthtoken ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: [{
                    Last_Name: leadData.name?.split(' ').slice(1).join(' ') || leadData.name || 'Unknown',
                    First_Name: leadData.name?.split(' ')[0] || '',
                    Email: leadData.email,
                    Company: leadData.company || 'Unknown',
                    Description: leadData.description || 'Synced from AlphaClone'
                }]
            })
        });
        
        const data = await response.json();
        if (data.code === 'INVALID_TOKEN') {
            throw new Error('Invalid Token or Scope for Zoho CRM');
        }
        return data;
    }
};
