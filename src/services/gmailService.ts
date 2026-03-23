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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const gmailService = {
    /**
     * Proxy call to our internal Gmail API with retry on rate-limit / server errors
     */
    async apiCall(endpoint: string, userId: string, options: RequestInit = {}, retries = 2): Promise<any> {
        const baseUrl = typeof window !== 'undefined' 
            ? window.location.origin 
            : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
            
        const url = new URL(`${baseUrl}/api/gmail/${endpoint}`);
        url.searchParams.set('userId', userId);

        for (let attempt = 0; attempt <= retries; attempt++) {
            const response = await fetch(url.toString(), {
                ...options,
                headers: {
                    ...options.headers,
                    'Content-Type': 'application/json',
                },
            });

            // Rate limited or server error — retry with backoff
            if ((response.status === 429 || response.status >= 500) && attempt < retries) {
                const backoff = (attempt + 1) * 1200; // 1.2s, 2.4s
                console.warn(`Gmail API ${response.status} on ${endpoint}, retrying in ${backoff}ms (attempt ${attempt + 1}/${retries})`);
                await sleep(backoff);
                continue;
            }

            if (!response.ok) {
                let errorMsg = 'Gmail API request failed';
                try {
                    const error = await response.json();
                    errorMsg = error.error || errorMsg;
                } catch { /* ignore parse error */ }
                throw new Error(errorMsg);
            }

            return await response.json();
        }
    },

    /**
     * List threads with details — fetches thread metadata first, then details in batches of 5
     * to avoid hitting Google's per-user rate limit
     */
    async listThreads(userId: string, maxResults = 20, pageToken?: string, labelIds: string[] = ['INBOX']): Promise<{ threads: GmailMessage[], nextPageToken?: string }> {
        const baseUrl = typeof window !== 'undefined' 
            ? window.location.origin 
            : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');

        const url = new URL(`${baseUrl}/api/gmail/threads`);
        url.searchParams.set('userId', userId);
        url.searchParams.set('maxResults', maxResults.toString());
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        labelIds.forEach(label => url.searchParams.append('labelIds', label));

        const response = await fetch(url.toString());
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to list threads');
        }
        const data = await response.json();

        if (!data.threads || data.threads.length === 0) return { threads: [] };

        // Fetch thread details in sequential batches of 5 to avoid rate limiting
        const BATCH_SIZE = 5;
        const results: (GmailMessage | null)[] = [];

        for (let i = 0; i < data.threads.length; i += BATCH_SIZE) {
            const batch = data.threads.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(
                batch.map(async (thread: any) => {
                    try {
                        const detail = await this.getThreadRaw(userId, thread.id);
                        if (!detail.messages || detail.messages.length === 0) return null;

                        const lastMsg = detail.messages[detail.messages.length - 1];
                        const parsed = this.parseMessageDetail(lastMsg);
                        parsed.messageCount = detail.messages.length;
                        return parsed;
                    } catch (err) {
                        console.warn(`Failed to fetch thread ${thread.id}:`, err);
                        return null;
                    }
                })
            );

            results.push(...batchResults);

            // Small delay between batches to respect rate limits
            if (i + BATCH_SIZE < data.threads.length) {
                await sleep(300);
            }
        }

        return {
            threads: results.filter((t): t is GmailMessage => t !== null),
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
     * Send Email (supports reply via threadId) — with retry
     */
    async sendMessage(userId: string, to: string, subject: string, messageBody: string, threadId?: string): Promise<any> {
        return this.apiCall('messages/send', userId, {
            method: 'POST',
            body: JSON.stringify({ to, subject, messageBody, threadId })
        }, 2); // 2 retries for send
    },

    /**
     * Helper to parse Gmail API response
     */
    parseMessageDetail(detail: any): GmailMessage {
        const headers = detail.payload?.headers || [];
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
        if (!payload) return '';

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
