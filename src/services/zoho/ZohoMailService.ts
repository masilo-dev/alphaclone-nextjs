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

        console.log(`[ZohoMailService] Fetching accounts from Zoho: https://${config.mailApiHost}/api/accounts`);
        const accountsResponse = await fetch(`https://${config.mailApiHost}/api/accounts`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
        });
        const accountsData = await accountsResponse.json();
        console.log('[ZohoMailService] Accounts response:', JSON.stringify(accountsData));
        const accountId = accountsData?.data?.[0]?.accountId;
        if (accountId) {
            console.log(`[ZohoMailService] Found accountId: ${accountId}. Saving to config.`);
            await this.saveConfig({ accountId: String(accountId) });
            config.accountId = String(accountId);
        } else {
            console.error('[ZohoMailService] No accountId found in Zoho response!');
        }

        return { accessToken, config };
    }

    private async getMailBase(): Promise<{ base: string; accountId: string }> {
        const config = await this.getConfig();
        if (!config?.mailApiHost) {
            throw new Error('Zoho Mail is not fully configured. Please reconnect your account to fix this.');
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
        const data = await this.callZohoAPI(`https://${config.mailApiHost}/api/accounts`);
        return data;
    }

    /**
     * List folders for a specific account
     */
    async getFolders(): Promise<ZohoFolder[]> {
        const { base } = await this.getMailBase();
        console.log(`[ZohoMailService] Calling Zoho API: ${base}/folders`);
        const data = await this.callZohoAPI(`${base}/folders`);
        console.log(`[ZohoMailService] getFolders response data count: ${data?.data?.length || 0}`);
        return (data?.data ?? []) as ZohoFolder[];
    }

    /**
     * List messages in a folder
     */
    async getMessages(folderId: string, limit = 20, start = 1): Promise<ZohoMessage[]> {
        const { base } = await this.getMailBase();
        const url = `${base}/messages/view?folderId=${encodeURIComponent(folderId)}&limit=${limit}&start=${start}`;
        console.log(`[ZohoMailService] Calling Zoho API: ${url}`);
        const data = await this.callZohoAPI(url);
        console.log(`[ZohoMailService] getMessages response data count: ${data?.data?.length || 0}`);
        return (data?.data ?? []) as ZohoMessage[];
    }

    async getMessageContent(messageId: string, folderId: string) {
        const { base } = await this.getMailBase();
        const url = `${base}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/content`;
        console.log(`[ZohoMailService] Calling Zoho API: ${url}`);
        const data = await this.callZohoAPI(url);
        console.log(`[ZohoMailService] getMessageContent response success: ${!!data?.data}`);
        return data?.data ?? data;
    }

    async sendEmail(params: {
        fromAddress: string;
        toAddress: string;
        subject: string;
        content: string;
        ccAddress?: string;
        bccAddress?: string;
    }) {
        const { base } = await this.getMailBase();
        const data = await this.callZohoAPI(`${base}/messages`, {
            method: 'POST',
            body: JSON.stringify(params),
        });
        return data;
    }

    /**
     * Search messages
     */
    async searchMessages(query: string): Promise<ZohoMessage[]> {
        const { base } = await this.getMailBase();
        const data = await this.callZohoAPI(
            `${base}/messages/search?searchFilter=${encodeURIComponent(query)}`
        );
        return (data?.data ?? []) as ZohoMessage[];
    }

    async deleteMessage(messageId: string, folderId: string) {
        const { base } = await this.getMailBase();
        const data = await this.callZohoAPI(
            `${base}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}`,
            { method: 'DELETE' }
        );
        return data;
    }

    async archiveMessage(messageId: string, currentFolderId: string) {

        const folders = await this.getFolders();
        const archiveFolder = folders.find(f => f.folderName.toLowerCase().includes('archive'));
        if (!archiveFolder) throw new Error('Archive folder not found in your Zoho Mail account');

        const { base } = await this.getMailBase();
        const data = await this.callZohoAPI(
            `${base}/folders/${encodeURIComponent(currentFolderId)}/messages/${encodeURIComponent(messageId)}`,
            {
                method: 'PUT',
                body: JSON.stringify({ folderId: archiveFolder.folderId }),
            }
        );
        return data;
    }

    async markAsRead(messageId: string, folderId: string, isRead = true) {
        const { base } = await this.getMailBase();
        const data = await this.callZohoAPI(
            `${base}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}`,
            {
                method: 'PUT',
                body: JSON.stringify({ status: isRead ? 'read' : 'unread' }),
            }
        );
        return data;
    }
}
