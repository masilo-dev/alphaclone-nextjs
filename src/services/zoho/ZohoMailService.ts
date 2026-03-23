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

        const accountsResponse = await fetch(`https://${config.mailApiHost}/api/accounts`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
        });
        const accountsData = await accountsResponse.json();
        const accountId = accountsData?.data?.[0]?.accountId;
        if (accountId) {
            await this.saveConfig({ accountId: String(accountId) });
            config.accountId = String(accountId);
        }

        return { accessToken, config };
    }

    /**
     * List email accounts for the user
     */
    async getAccounts() {
        const accessToken = await this.getValidAccessToken();
        if (!accessToken) throw new Error('Unauthorized');

        const config = await this.getConfig();
        const host = ZohoService.normalizeHost(config?.mailApiHost);
        if (!host) throw new Error('Mail host missing');

        const response = await fetch(`https://${host}/api/accounts`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
        });

        return await response.json();
    }

    /**
     * List folders for a specific account
     */
    async getFolders() {
        const { accessToken, config } = await this.ensureAccountId();
        if (!accessToken || !config?.accountId) throw new Error('Account ID missing');

        const response = await fetch(`https://${config.mailApiHost}/api/accounts/${config.accountId}/folders`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
        });

        const data = await response.json();
        return data.data as ZohoFolder[];
    }

    /**
     * List messages in a folder
     */
    async getMessages(folderId: string, limit: number = 20, start: number = 1) {
        const { accessToken, config } = await this.ensureAccountId();
        if (!accessToken || !config?.accountId) throw new Error('Account ID missing');

        const response = await fetch(
            `https://${config.mailApiHost}/api/accounts/${config.accountId}/messages/view?folderId=${folderId}&limit=${limit}&start=${start}`,
            {
                headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
            }
        );

        const data = await response.json();
        return data.data as ZohoMessage[];
    }

    /**
     * Get a single message content
     */
    async getMessageContent(messageId: string) {
        const { accessToken, config } = await this.ensureAccountId();
        if (!accessToken || !config?.accountId) throw new Error('Account ID missing');

        const response = await fetch(
            `https://${config.mailApiHost}/api/accounts/${config.accountId}/messages/${messageId}/content`,
            {
                headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
            }
        );

        const data = await response.json();
        return data.data; // Includes content, sender, subject, etc.
    }

    /**
     * Send an email
     */
    async sendEmail(params: {
        fromAddress: string;
        toAddress: string;
        subject: string;
        content: string;
        ccAddress?: string;
        bccAddress?: string;
    }) {
        const { accessToken, config } = await this.ensureAccountId();
        if (!accessToken || !config?.accountId) throw new Error('Account ID missing');

        const response = await fetch(
            `https://${config.mailApiHost}/api/accounts/${config.accountId}/messages`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params)
            }
        );

        return await response.json();
    }

    /**
     * Search messages
     */
    async searchMessages(query: string) {
        const { accessToken, config } = await this.ensureAccountId();
        if (!accessToken || !config?.accountId) throw new Error('Account ID missing');

        const response = await fetch(
            `https://${config.mailApiHost}/api/accounts/${config.accountId}/messages/search?searchFilter=${encodeURIComponent(query)}`,
            {
                headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
            }
        );

        const data = await response.json();
        return data.data as ZohoMessage[];
    }

    /**
     * Delete a message
     */
    async deleteMessage(messageId: string) {
        const { accessToken, config } = await this.ensureAccountId();
        if (!accessToken || !config?.accountId) throw new Error('Account ID missing');

        const response = await fetch(
            `https://${config.mailApiHost}/api/accounts/${config.accountId}/messages/${messageId}`,
            {
                method: 'DELETE',
                headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
            }
        );

        return await response.json();
    }

    /**
     * Archive a message (move to Archive folder)
     * Note: Usually involves a PUT to update folderId or a specific archive endpoint
     */
    async archiveMessage(messageId: string) {
        const { accessToken, config } = await this.ensureAccountId();
        if (!accessToken || !config?.accountId) throw new Error('Account ID missing');

        // Step 1: Find the Archive folder ID
        const folders = await this.getFolders();
        const archiveFolder = folders.find(f => f.folderName.toLowerCase().includes('archive'));
        if (!archiveFolder) throw new Error('Archive folder not found');

        const response = await fetch(
            `https://${config.mailApiHost}/api/accounts/${config.accountId}/messages/${messageId}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ folderId: archiveFolder.folderId })
            }
        );

        return await response.json();
    }

    /**
     * Mark a message as read/unread
     */
    async markAsRead(messageId: string, status: boolean = true) {
        const accessToken = await this.getValidAccessToken();
        const config = await this.getConfig();
        if (!accessToken || !config?.accountId) throw new Error('Account ID missing');

        const response = await fetch(
            `https://${config.mailApiHost}/api/accounts/${config.accountId}/messages/${messageId}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: status ? 'read' : 'unread' })
            }
        );

        return await response.json();
    }
}
