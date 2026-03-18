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
    
    const isEncrypted = isEncryptedFormat(token);
    
    if (isEncrypted && !secret) {
        console.error('[Zoho Token] Detected encrypted token but ENCRYPTION_SECRET is missing. Decryption impossible.');
        return token; // Fallback to returning ciphertext, which will likely fail later but at least it's logged
    }

    if (!isEncrypted) return token; // already plaintext

    try {
        return decrypt(token, secret!);
    } catch (e) {
        console.error('[Zoho Token] Decryption failed. The secret may have changed or the token is corrupted.', e);
        return token; // fallback to plaintext
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
                throw new Error(`Database error: ${error.message}`);
            }
            if (!integration) {
                console.warn(`[Zoho Token Debug] No Zoho integration record found for user ${userId}.`);
                return null;
            }
            if (!integration.config) {
                console.error(`[Zoho Token Debug] Integration found but config is null for user ${userId}`);
                throw new Error('Zoho integration configuration is missing.');
            }

            const config = integration.config;
            const secret = ENV.ENCRYPTION_SECRET;
            
            const accessToken = safeDecrypt(config.accessToken, secret);

            if (!config.expiryDate) {
                console.warn('[Zoho Token Debug] Config missing expiryDate, attempting refresh anyway.');
            } else {
                const expiresAt = new Date(config.expiryDate).getTime();
                if (Date.now() < expiresAt - 60000) { // If it expires in more than a minute
                    return accessToken;
                }
            }

            console.log('[Zoho Token Debug] Token expired or missing expiry, attempting refresh...');
            
            const refreshToken = safeDecrypt(config.refreshToken, secret);

            if (!refreshToken) {
                console.error('[Zoho Token Debug] No refresh token available.');
                throw new Error('Zoho session expired and no refresh token available. Please reconnect.');
            }

            // Refresh token
            return await this.refreshToken(userId, refreshToken, integration.id);
        } catch (err: any) {
            console.error('[Zoho Token Debug] Error in getValidToken:', err.message || err);
            // Re-throw so proxyRequest can catch it and report a descriptive error
            throw err;
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

            if (!ENV.ZOHO_CLIENT_ID || !ENV.ZOHO_CLIENT_SECRET) {
                console.error('[Zoho Refresh] CRITICAL: ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET is missing from environment.');
                throw new Error('Server configuration error: Zoho client credentials missing.');
            }

            const response = await fetch(`${accountsServer}/oauth/v2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    refresh_token: refreshToken,
                    client_id: ENV.ZOHO_CLIENT_ID,
                    client_secret: ENV.ZOHO_CLIENT_SECRET,
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
    async proxyRequest(userId: string, endpoint: string, options: RequestInit = {}, isRetry = false): Promise<any> {
        let token: string | null = null;
        try {
            token = await this.getValidToken(userId);
        } catch (err: any) {
            // Re-package error to be caught by API route
            const apiErr: any = new Error(`Zoho connection failed: ${err.message}`);
            apiErr.status = 401; // Most token errors imply a need for re-auth
            throw apiErr;
        }

        if (!token) {
            const apiErr: any = new Error('Zoho account not connected.');
            apiErr.status = 404;
            throw apiErr;
        }

        const supabaseAdmin = createSupabaseAdminClient();
        const { data: integration, error } = await supabaseAdmin
            .from('integrations')
            .select('id, config')
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
                .eq('id', integration.id); // Optimized: use integration.id directly
        }

        // ✅ Fix 3: Construct API URL
        let url = '';
        if (endpoint.startsWith('http')) {
            url = endpoint;
        } else if (endpoint === 'accounts') {
            url = `https://${mailApiHost}/api/accounts`;
        } else {
            // Always use V1: /api/accounts/{accountId}/{endpoint}
            url = `https://${mailApiHost}/api/accounts/${accountId}/${endpoint}`;
        }

        console.log(`[Zoho Proxy] Requesting: ${url}`);

        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Zoho-oauthtoken ${token}`,
                'Content-Type': 'application/json',
            },
        });

        // ✅ NEW: Handle 401 Unauthorized by attempting a forced token refresh (retry once)
        if (response.status === 401 && !isRetry) {
            console.warn(`[Zoho Proxy] 401 Unauthorized for ${url}. Attempting token refresh...`);
            
            const refreshToken = safeDecrypt(integration.config.refreshToken, ENV.ENCRYPTION_SECRET);
            if (refreshToken) {
                try {
                    await this.refreshToken(userId, refreshToken, integration.id);
                    // Successfully refreshed, now retry the request
                    return this.proxyRequest(userId, endpoint, options, true);
                } catch (refreshErr) {
                    console.error('[Zoho Proxy] Failed to refresh token during 401 retry:', refreshErr);
                    // Refresh failed, proceed to normal error handling
                }
            } else {
                console.error('[Zoho Proxy] No refresh token found, cannot retry 401 error.');
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Zoho Proxy Error] ${url} → ${response.status}: ${errorText.substring(0, 500)}`);

            let description = `Zoho API Error ${response.status}: ${errorText.substring(0, 150)}`;
            try {
                const errorJson = JSON.parse(errorText);
                const errorCode = errorJson.data?.errorCode || errorJson.errorCode || errorJson.error;
                
                const errorMessageMap: Record<string, string> = {
                    'INVALID_OAUTHTOKEN': 'Zoho session expired. Refreshing...',
                    'LIMIT_EXCEEDED': 'Zoho API rate limit reached. Please try again in a few minutes.',
                    'FOLDER_NOT_FOUND': 'The requested mail folder was not found.',
                    'INVALID_INPUT': 'Invalid request parameters sent to Zoho.',
                    'USER_DISABLED': 'This Zoho account is currently disabled.',
                    'ACCESS_DENIED': 'Access to this Zoho resource is denied. Check permissions.',
                    'INTERNAL_ERROR': 'Zoho internal server error. Please try again later.'
                };

                description = errorMessageMap[errorCode as string] || 
                             errorJson.status?.description || 
                             errorJson.error_message || 
                             errorJson.error || 
                             description;
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
     * Update message status (Read/Unread/Star)
     * mode: markAsRead, markAsUnread, setFlag, applyLabel
     */
    async updateMessage(userId: string, messageId: string, mode: string, params: any = {}) {
        return this.proxyRequest(userId, `messages/${messageId}`, {
            method: 'PUT',
            body: JSON.stringify({
                mode,
                ...params
            }),
        });
    },

    /**
     * Reply to an email
     */
    async replyMessage(userId: string, messageId: string, data: {
        toAddress: string;
        subject: string;
        content: string;
        fromAddress?: string;
    }) {
        return this.proxyRequest(userId, `messages/${messageId}/reply`, {
            method: 'POST',
            body: JSON.stringify({
                fromAddress: data.fromAddress,
                toAddress: data.toAddress,
                subject: data.subject,
                content: data.content,
                mailFormat: 'html'
            }),
        });
    },

    /**
     * Forward an email
     */
    async forwardMessage(userId: string, messageId: string, data: {
        toAddress: string;
        subject: string;
        content: string;
        fromAddress?: string;
    }) {
        return this.proxyRequest(userId, `messages/${messageId}/forward`, {
            method: 'POST',
            body: JSON.stringify({
                fromAddress: data.fromAddress,
                toAddress: data.toAddress,
                subject: data.subject,
                content: data.content,
                mailFormat: 'html'
            }),
        });
    },

    /**
     * Save an email as draft
     */
    async saveDraft(userId: string, data: {
        toAddress: string;
        subject: string;
        content: string;
        fromAddress?: string;
    }) {
        return this.proxyRequest(userId, 'messages', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'saveDraft',
                fromAddress: data.fromAddress,
                toAddress: data.toAddress,
                subject: data.subject,
                content: data.content,
                mailFormat: 'html'
            }),
        });
    },
};
