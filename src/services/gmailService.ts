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
     * Proxy call to our internal Gmail API
     */
    async apiCall(endpoint: string, userId: string, options: RequestInit = {}) {
        const url = new URL(`${window.location.origin}/api/gmail/${endpoint}`);
        url.searchParams.set('userId', userId);

        const response = await fetch(url.toString(), {
            ...options,
            headers: {
                ...options.headers,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Gmail API request failed');
        }

        return await response.json();
    },

    /**
     * List threads with details
     */
    async listThreads(userId: string, maxResults = 20, pageToken?: string, labelIds: string[] = ['INBOX']): Promise<{ threads: GmailMessage[], nextPageToken?: string }> {
        let endpoint = `threads?maxResults=${maxResults}`;
        if (pageToken) endpoint += `&pageToken=${pageToken}`;
        if (labelIds && labelIds.length > 0) {
            labelIds.forEach(label => endpoint += `&labelIds=${label}`); // Note: apiCall handles searchParams append differently if multiple, let's fix below
        }

        // Refined apiCall for multiple params
        const url = new URL(`${window.location.origin}/api/gmail/threads`);
        url.searchParams.set('userId', userId);
        url.searchParams.set('maxResults', maxResults.toString());
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        labelIds.forEach(label => url.searchParams.append('labelIds', label));

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!data.threads) return { threads: [] };

        const threadDetails = await Promise.all(
            data.threads.map(async (thread: any) => {
                const detail = await this.getThreadRaw(userId, thread.id);
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
     * Get raw thread detail
     */
    async getThreadRaw(userId: string, threadId: string): Promise<any> {
        return this.apiCall(`threads/${threadId}`, userId);
    },

    /**
     * Get full thread (conversation)
     */
    async getThread(userId: string, threadId: string): Promise<GmailMessage[]> {
        const data = await this.getThreadRaw(userId, threadId);
        if (!data.messages) return [];

        return data.messages.map((msg: any) => this.parseMessageDetail(msg));
    },

    /**
     * Modify Thread (Archive, Trash, Star)
     */
    async modifyThread(userId: string, threadId: string, addLabels: string[], removeLabels: string[]): Promise<void> {
        await this.apiCall(`threads/${threadId}/modify`, userId, {
            method: 'POST',
            body: JSON.stringify({ addLabelIds: addLabels, removeLabelIds: removeLabels })
        });
    },

    /**
     * Send Email (supports reply via threadId)
     */
    async sendMessage(userId: string, to: string, subject: string, messageBody: string, threadId?: string): Promise<any> {
        return this.apiCall('messages/send', userId, {
            method: 'POST',
            body: JSON.stringify({ to, subject, messageBody, threadId })
        });
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
        const getRawData = (p: any): string | null => {
            if (p.body && p.body.data) return p.body.data;
            if (p.parts) {
                const html = p.parts.find((sub: any) => sub.mimeType === 'text/html');
                if (html) return getRawData(html);
                const text = p.parts.find((sub: any) => sub.mimeType === 'text/plain');
                if (text) return getRawData(text);
                for (const sub of p.parts) {
                    const found = getRawData(sub);
                    if (found) return found;
                }
            }
            return null;
        };

        const body = getRawData(payload);
        if (body) {
            // Buffer is not available in browsers, use atob for base64
            try {
                const b64 = body.replace(/-/g, '+').replace(/_/g, '/');
                return decodeURIComponent(escape(atob(b64)));
            } catch (e) {
                console.error('Failed to decode body:', e);
            }
        }
        return payload.snippet || '';
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
