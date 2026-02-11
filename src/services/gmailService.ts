import { supabase } from '../lib/supabase';

export interface GmailMessage {
    id: string;
    threadId: string;
    snippet: string;
    subject?: string;
    from?: string;
    date?: string;
    body?: string;
    messageCount?: number;
}

export const gmailService = {
    /**
     * Get valid access token (refreshes if needed)
     */
    async getValidToken(userId: string): Promise<string | null> {
        const { data: tokenData, error } = await supabase
            .from('gmail_sync_tokens')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !tokenData) return null;

        const expiresAt = new Date(tokenData.expires_at).getTime();
        if (Date.now() < expiresAt - 60000) { // If it expires in more than a minute
            return tokenData.access_token;
        }

        // Refresh token
        return await this.refreshToken(userId, tokenData.refresh_token);
    },

    /**
     * Refresh Google OAuth Token
     */
    async refreshToken(userId: string, refreshToken: string): Promise<string | null> {
        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    refresh_token: refreshToken,
                    client_id: process.env.GOOGLE_CLIENT_ID!,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                    grant_type: 'refresh_token',
                }),
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

            await supabase
                .from('gmail_sync_tokens')
                .update({
                    access_token: data.access_token,
                    expires_at: expiresAt,
                })
                .eq('user_id', userId);

            return data.access_token;
        } catch (err) {
            console.error('Failed to refresh Gmail token:', err);
            return null;
        }
    },

    /**
     * List threads with details
     */
    async listThreads(userId: string, maxResults = 20, pageToken?: string, labelIds: string[] = ['INBOX']): Promise<{ threads: GmailMessage[], nextPageToken?: string }> {
        const token = await this.getValidToken(userId);
        if (!token) throw new Error('Gmail not connected');

        let url = `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${maxResults}`;
        if (pageToken) url += `&pageToken=${pageToken}`;

        if (labelIds && labelIds.length > 0) {
            labelIds.forEach(label => url += `&labelIds=${label}`);
        }

        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();

        if (!data.threads) return { threads: [] };

        const threadDetails = await Promise.all(
            data.threads.map(async (thread: any) => {
                const detailResp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const detail = await detailResp.json();
                if (!detail.messages || detail.messages.length === 0) return null;

                const lastMsg = detail.messages[detail.messages.length - 1];
                const parsed = this.parseMessageDetail(lastMsg);
                parsed.messageCount = detail.messages.length;
                return parsed;
            })
        );

        return {
            threads: threadDetails.filter((t: any) => t !== null) as GmailMessage[],
            nextPageToken: data.nextPageToken
        };
    },

    /**
     * Get full thread (conversation)
     */
    async getThread(userId: string, threadId: string): Promise<GmailMessage[]> {
        const token = await this.getValidToken(userId);
        if (!token) throw new Error('Gmail not connected');

        const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!data.messages) return [];

        return data.messages.map((msg: any) => this.parseMessageDetail(msg));
    },

    /**
     * Modify Thread (Archive, Trash, Star)
     */
    async modifyThread(userId: string, threadId: string, addLabels: string[], removeLabels: string[]): Promise<void> {
        const token = await this.getValidToken(userId);
        if (!token) throw new Error('Gmail not connected');

        await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                addLabelIds: addLabels,
                removeLabelIds: removeLabels
            })
        });
    },

    /**
     * List messages from Inbox with Pagination (Legacy)
     */
    async listMessages(userId: string, maxResults = 20, pageToken?: string): Promise<{ messages: GmailMessage[], nextPageToken?: string }> {
        const token = await this.getValidToken(userId);
        if (!token) throw new Error('Gmail not connected');

        let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
        if (pageToken) url += `&pageToken=${pageToken}`;

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const data = await response.json();
        if (!data.messages) return { messages: [] };

        // Fetch details for each message
        const messageDetails = await Promise.all(
            data.messages.map(async (msg: any) => {
                const detailResp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const detail = await detailResp.json();
                return this.parseMessageDetail(detail);
            })
        );

        return {
            messages: messageDetails,
            nextPageToken: data.nextPageToken
        };
    },

    /**
     * Get single message details
     */
    async getMessage(userId: string, messageId: string): Promise<GmailMessage> {
        const token = await this.getValidToken(userId);
        if (!token) throw new Error('Gmail not connected');

        const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const detail = await response.json();
        return this.parseMessageDetail(detail);
    },

    /**
     * Helper to parse Gmail API response
     */
    parseMessageDetail(detail: any): GmailMessage {
        const headers = detail.payload.headers;
        const subject = headers.find((h: any) => h.name === 'Subject')?.value;
        const from = headers.find((h: any) => h.name === 'From')?.value;
        const date = headers.find((h: any) => h.name === 'Date')?.value;

        return {
            id: detail.id,
            threadId: detail.threadId,
            snippet: detail.snippet,
            subject,
            from,
            date,
            body: this.extractBody(detail.payload),
        };
    },

    /**
     * Extract HTML or Text body from payload
     */
    extractBody(payload: any): string {
        let body = '';

        const findPart = (parts: any[], mimeType: string) => {
            return parts.find(p => p.mimeType === mimeType);
        };

        if (payload.body && payload.body.data) {
            body = payload.body.data;
        } else if (payload.parts) {
            // Try to find HTML part
            const htmlPart = findPart(payload.parts, 'text/html');
            if (htmlPart && htmlPart.body && htmlPart.body.data) {
                body = htmlPart.body.data;
            } else {
                // Formatting fallback or nested parts
                const textPart = findPart(payload.parts, 'text/plain');
                if (textPart && textPart.body && textPart.body.data) {
                    body = textPart.body.data;
                } else {
                    // Recurse for nested parts (e.g. multipart/alternative inside multipart/related)
                    for (const part of payload.parts) {
                        if (part.parts) {
                            const found = this.extractBody(part);
                            if (found) return found; // Return first found valid body (raw, not decoded yet as recursion loop handles extraction)
                            // Actually, extractBody returns decoded string. 
                            // Slightly inconsistent recursion here. 
                            // Let's simplify recursion.
                        }
                    }
                }
            }
        }

        // Simpler recursive approach if above failed
        if (!body && payload.parts) {
            for (const part of payload.parts) {
                // Check this part directly
                if (part.mimeType === 'text/html' && part.body?.data) {
                    body = part.body.data;
                    break;
                }
                // Recurse
                if (part.parts) {
                    // We need to call extractBody on part, but extractBody returns decoded. 
                    // For this helper to work best, we should maybe split finding and decoding.
                    // But for now let's just grab the data property if we can find it.
                }
            }
        }

        // Re-implementing robust extraction:
        const getRawData = (p: any): string | null => {
            if (p.body && p.body.data) return p.body.data;
            if (p.parts) {
                const html = p.parts.find((sub: any) => sub.mimeType === 'text/html');
                if (html) return getRawData(html);
                const text = p.parts.find((sub: any) => sub.mimeType === 'text/plain');
                if (text) return getRawData(text);
                // Search deeper
                for (const sub of p.parts) {
                    const found = getRawData(sub);
                    if (found) return found;
                }
            }
            return null;
        };

        if (!body) body = getRawData(payload) || '';

        if (body) {
            const buff = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
            return buff.toString('utf-8');
        }
        return payload.snippet || '';
    },

    /**
     * Send Email
     */
    /**
     * Send Email (supports reply via threadId)
     */
    async sendMessage(userId: string, to: string, subject: string, body: string, threadId?: string): Promise<any> {
        const token = await this.getValidToken(userId);
        if (!token) throw new Error('Gmail not connected');

        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `To: ${to}`,
            `Subject: ${utf8Subject}`,
            `Content-Type: text/plain; charset="UTF-8"`,
            '',
            body,
        ];

        // If replying, we generally just send the message. Gmail API 'threadId' param groups it.
        // Standard email headers like In-Reply-To are good practice but Gmail API handles grouping via threadId well.

        const message = messageParts.join('\n');
        const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const payload: any = { raw: encodedMessage };
        if (threadId) {
            payload.threadId = threadId;
        }

        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        return await response.json();
    },

    /**
     * Check if user has Gmail integrated
     */
    async checkIntegration(userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('gmail_sync_tokens')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

        return !!data && !error;
    }
};
