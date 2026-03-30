import { ZohoService } from './ZohoService';

export interface ZohoMessage {
    messageId: string;
    sender: string;
    subject: string;
    receivedTime: string;
    snippet: string;
    content?: string;
    hasAttachment: boolean;
    folderId: string;
}

export interface ZohoFolder {
    folderId: string;
    folderName: string;
    unreadCount: number;
    totalCount: number;
}

export interface ZohoAccount {
    accountId: string;
    mailAddress: string;
    isPrimary: boolean;
    status: string;
}

export class ZohoMailService extends ZohoService {
    private async ensureAccountId() {
        const accessToken = await this.getValidAccessToken();
        const config = await this.getConfig();
        if (!accessToken || !config?.mailApiHost) {
            return { accessToken: null, config: null };
        }

        if (config.accountId) {
            return { accessToken, config };
        }

        const accountsData = await this.getAccounts();
        const accountId = accountsData?.data?.[0]?.accountId;
        if (accountId) {
            await this.saveConfig({ accountId: String(accountId) });
            config.accountId = String(accountId);
        }

        return { accessToken, config };
    }

    private async getMailBase(): Promise<{ base: string; accountId: string }> {
        const config = await this.getConfig();
        if (!config?.mailApiHost) {
            throw new Error('Zoho Mail is not fully configured. Please reconnect your account.');
        }
        
        let accountId = config?.accountId;
        if (!accountId) {
            const { config: updatedConfig } = await this.ensureAccountId();
            accountId = updatedConfig?.accountId;
            if (!accountId) throw new Error('Zoho Mail not configured: missing accountId');
        }

        return {
            base: `https://${config.mailApiHost}/api/accounts/${accountId}`,
            accountId: accountId,
        };
    }

    async getAccounts() {
        const config = await this.getConfig();
        if (!config?.mailApiHost) throw new Error('Zoho Mail not configured: missing mailApiHost');
        return await this.callZohoAPI(`https://${config.mailApiHost}/api/accounts`);
    }

    /**
     * Get authorized sender addresses for the account
     */
    async getSenderAddresses(): Promise<string[]> {
        try {
            const data = await this.getAccounts();
            const accounts = (data?.data || []) as any[];
            const addresses: string[] = [];
            
            for (const acc of accounts) {
                if (acc.primaryEmailAddress) addresses.push(acc.primaryEmailAddress);
                if (acc.incomingUserName) addresses.push(acc.incomingUserName);
                if (acc.mailAddress) addresses.push(acc.mailAddress); // fallback
                if (Array.isArray(acc.sendAsAddress)) {
                    addresses.push(...acc.sendAsAddress.map((s: any) => s.mailId || s.emailAddress || s).filter(Boolean));
                }
            }
            
            return [...new Set(addresses)].filter(Boolean);
        } catch (err) {
            console.error('[ZohoMailService] Failed to fetch sender addresses:', err);
            return [];
        }
    }

    async getFolders(): Promise<ZohoFolder[]> {
        const { base } = await this.getMailBase();
        const data = await this.callZohoAPI(`${base}/folders`);
        return (data?.data ?? []) as ZohoFolder[];
    }

    async getMessages(folderId: string, limit = 20, start = 1): Promise<ZohoMessage[]> {
        const { base } = await this.getMailBase();
        const url = `${base}/messages/view?folderId=${encodeURIComponent(folderId)}&limit=${limit}&start=${start}`;
        const data = await this.callZohoAPI(url);
        return (data?.data ?? []) as ZohoMessage[];
    }

    async getMessageContent(messageId: string, folderId: string) {
        const { base } = await this.getMailBase();
        const url = `${base}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/content`;
        try {
            const data = await this.callZohoAPI(url);
            let contentStr = '';
            if (typeof data === 'string') contentStr = data;
            else if (data?.data) contentStr = typeof data.data === 'string' ? data.data : data.data.content || '';
            else if (data?.content) contentStr = data.content;

            // Rewrite secure Zoho inline image URLs so our frontend can proxy them
            if (contentStr) {
                contentStr = contentStr.replace(
                    /src=["'](?:https?:\/\/[^\/]+)?(\/api\/accounts\/[^"']+\/messages\/[^"']+\/attachments\/[^"']+)["']/gi,
                    (match, path) => {
                        return `src="/api/zoho/mail?action=proxy-image&path=${encodeURIComponent(path)}"`;
                    }
                );
            }
            return { content: contentStr };
        } catch (err: any) {
            if (err?.status === 404) {
                console.warn('[ZohoMailService] Message not found (likely deleted or moved):', messageId);
                return { content: '', error: 'The email content could not be retrieved. It may have been moved or deleted.', status: 404 };
            }
            throw err;
        }
    }

    async proxyImage(path: string) {
        const config = await this.getConfig();
        const accessToken = await this.getValidAccessToken();
        if (!accessToken || !config?.mailApiHost) throw new Error('Unauthorized');

        // Ensure we only proxy valid attachment URLs
        if (!path.startsWith('/api/accounts')) throw new Error('Invalid proxy path');

        const url = `https://${config.mailApiHost}${path}`;
        const res = await fetch(url, {
            headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`
            }
        });
        
        if (!res.ok) throw new Error(`Failed to proxy image: ${res.status}`);
        return res;
    }

    async sendEmail(params: {
        fromAddress?: string;
        toAddress: string;
        subject: string;
        content: string;
        ccAddress?: string;
        bccAddress?: string;
    }) {
        const { base } = await this.getMailBase();
        
        // 1. Fetch authorized addresses to validate or fill fromAddress
        const validAddresses = await this.getSenderAddresses();
        
        if (!params.fromAddress || (validAddresses.length > 0 && !validAddresses.includes(params.fromAddress))) {
            const primary = validAddresses.length > 0 ? validAddresses[0] : null;
            if (!primary && !params.fromAddress) {
                throw new Error('No authorized fromAddress found for this Zoho account.');
            }
            if (primary && params.fromAddress !== primary) {
                console.warn(`[ZohoMailService] Using primary address "${primary}" instead of provided "${params.fromAddress}"`);
                params.fromAddress = primary;
            }
        }

        return await this.callZohoAPI(`${base}/messages`, {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    async searchMessages(query: string): Promise<ZohoMessage[]> {
        const { base } = await this.getMailBase();
        const data = await this.callZohoAPI(
            `${base}/messages/search?searchFilter=${encodeURIComponent(query)}`
        );
        return (data?.data ?? []) as ZohoMessage[];
    }

    async deleteMessage(messageId: string, folderId: string) {
        const { base } = await this.getMailBase();
        try {
            return await this.callZohoAPI(
                `${base}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}`,
                { method: 'DELETE' }
            );
        } catch (err: any) {
            if (err?.status === 404) {
                console.warn('[ZohoMailService] Delete failed: Message not found:', messageId);
                return { success: true, message: 'Message already gone or moved' };
            }
            throw err;
        }
    }

    async archiveMessage(messageId: string, currentFolderId: string) {
        const folders = await this.getFolders();
        const archiveFolder = folders.find(f => f.folderName.toLowerCase().includes('archive'));
        if (!archiveFolder) throw new Error('Archive folder not found in your Zoho Mail account');

        const { base } = await this.getMailBase();
        return await this.callZohoAPI(
            `${base}/folders/${encodeURIComponent(currentFolderId)}/messages/${encodeURIComponent(messageId)}`,
            {
                method: 'PUT',
                body: JSON.stringify({ folderId: archiveFolder.folderId }),
            }
        );
    }

    async markAsRead(messageId: string, folderId: string, isRead = true) {
        const { base } = await this.getMailBase();
        return await this.callZohoAPI(
            `${base}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}`,
            {
                method: 'PUT',
                body: JSON.stringify({ status: isRead ? 'read' : 'unread' }),
            }
        );
    }
}
