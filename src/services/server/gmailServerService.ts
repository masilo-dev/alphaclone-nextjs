import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveEmailProviderConfig } from '@/lib/email/providerIntegrationResolver';
import { sendWithProviderSdk } from '@/lib/email/providerSdk';
import { ImapFlow } from 'imapflow';

export const gmailServerService = {
    /**
     * Get IMAP client for a user
     */
    async getImapClient(userId: string) {
        const config = await resolveEmailProviderConfig({ preferredUserId: userId, preferredProvider: 'gmail' });
        if (!config || config.provider !== 'gmail') {
            throw new Error('Gmail integration not configured with App Password.');
        }

        const client = new ImapFlow({
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            auth: {
                user: config.fromEmail!,
                pass: config.apiKey, // App Password
            },
            logger: false,
        });

        return client;
    },

    /**
     * List threads using IMAP (grouped by X-GM-THRID)
     */
    async listThreads(userId: string, maxResults = 20) {
        const client = await this.getImapClient(userId);
        await client.connect();

        try {
            const lock = await client.getMailboxLock('INBOX');
            try {
                // Fetch recent messages with Gmail thread ID extension
                const messages = [];
                // @ts-ignore - gmThreadId is supported by Gmail IMAP
                for await (const msg of client.fetch({ last: maxResults }, { envelope: true, source: false, gmThreadId: true })) {
                    messages.push({
                        id: msg.uid.toString(),
                        // @ts-ignore
                        threadId: msg.gmThreadId || msg.uid.toString(),
                        subject: msg.envelope.subject,
                        from: msg.envelope.from?.[0] ? `${msg.envelope.from[0].name || ''} <${msg.envelope.from[0].address}>`.trim() : 'Unknown',
                        date: msg.envelope.date?.toISOString(),
                        snippet: '', // Snippet is hard to get via IMAP without fetching body, leaving empty or using subject
                    });
                }

                // Group by threadId and take the latest message per thread
                const threadsMap = new Map();
                for (const msg of messages) {
                    if (!threadsMap.has(msg.threadId)) {
                        threadsMap.set(msg.threadId, msg);
                    }
                }

                return { threads: Array.from(threadsMap.values()) };
            } finally {
                lock.release();
            }
        } finally {
            await client.logout();
        }
    },

    /**
     * Get thread details
     */
    async getThread(userId: string, threadId: string) {
        const client = await this.getImapClient(userId);
        await client.connect();

        try {
            const lock = await client.getMailboxLock('INBOX');
            try {
                const messages = [];
                // Search for messages in this thread
                // @ts-ignore - gmThreadId is supported by Gmail IMAP search
                const uids = await client.search({ gmThreadId: threadId });
                
                for await (const msg of client.fetch(uids, { envelope: true, source: true, gmThreadId: true })) {
                    messages.push({
                        id: msg.uid.toString(),
                        threadId: threadId,
                        subject: msg.envelope.subject,
                        from: msg.envelope.from?.[0] ? `${msg.envelope.from[0].name || ''} <${msg.envelope.from[0].address}>`.trim() : 'Unknown',
                        date: msg.envelope.date?.toISOString(),
                        body: msg.source.toString(), // Raw source, front-end will need to parse or we parse here
                    });
                }

                return { messages };
            } finally {
                lock.release();
            }
        } finally {
            await client.logout();
        }
    },

    /**
     * Send email using SMTP
     */
    async sendEmail(userId: string, payload: { to: string; subject: string; messageBody: string; threadId?: string; cc?: string; bcc?: string; attachments?: any[] }) {
        const config = await resolveEmailProviderConfig({ preferredUserId: userId, preferredProvider: 'gmail' });
        if (!config || config.provider !== 'gmail') {
            throw new Error('Gmail integration not configured for sending.');
        }

        const result = await sendWithProviderSdk('gmail', {
            apiKey: config.apiKey,
            fromEmail: config.fromEmail!,
            fromName: config.fromName,
            to: payload.to,
            subject: payload.subject,
            html: payload.messageBody, // Assuming HTML for "smart" features, or we can detect
            cc: payload.cc ? [payload.cc] : undefined,
            bcc: payload.bcc ? [payload.bcc] : undefined,
            attachments: payload.attachments,
            userId,
        });

        if (!result.ok) {
            throw new Error(result.error || 'Failed to send email via Gmail SMTP');
        }

        return { id: result.emailId, threadId: payload.threadId };
    },

    /**
     * Legacy proxyRequest placeholder to prevent immediate crashes during transition
     */
    async proxyRequest(userId: string, endpoint: string, options: any = {}) {
        console.warn(`Legacy proxyRequest called for ${endpoint}. Redirecting to new implementation...`);
        
        if (endpoint.includes('threads') && !endpoint.includes('modify')) {
            if (endpoint.includes('/')) {
                const threadId = endpoint.split('/').pop();
                return this.getThread(userId, threadId!);
            }
            return this.listThreads(userId);
        }

        if (endpoint === 'messages/send') {
            const body = JSON.parse(options.body);
            // Convert Gmail API payload to our internal payload
            return this.sendEmail(userId, {
                to: body.to,
                subject: body.subject,
                messageBody: body.messageBody || body.raw, // Simplified
                threadId: body.threadId,
            });
        }

        throw new Error(`Endpoint ${endpoint} is no longer supported via proxyRequest. Use the new typed methods.`);
    }
};

