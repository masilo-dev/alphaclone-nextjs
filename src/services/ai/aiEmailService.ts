import { aiService } from './aiService';
import { gmailService } from '../gmailService';
import { zohoService } from '../zohoService';

export interface EmailMessage {
    id: string;
    threadId: string;
    from: string;
    subject: string;
    body: string;
    provider: 'gmail' | 'zoho';
    date: string;
}

export const aiEmailService = {
    /**
     * Determine if an email should receive an autonomous response
     */
    shouldAutoRespond(message: EmailMessage): boolean {
        const fromLower = message.from.toLowerCase();
        const subjectLower = message.subject.toLowerCase();

        // 1. Filter out known automated senders
        const automatedSenders = [
            'no-reply', 'noreply', 'notifications', 'alert', 'system',
            'support@github.com', 'google.com', 'microsoft.com', 'zoho.com',
            'linkedin.com', 'twitter.com', 'facebook.com', 'newsletter'
        ];

        if (automatedSenders.some(sender => fromLower.includes(sender))) {
            return false;
        }

        // 2. Filter out transactional subjects
        const automatedSubjects = [
            'confirmation', 'receipt', 'welcome', 'verify', 'update',
            'password', 'security', 'billing', 'invoice', 'statement',
            'unsubscribe', 'notification'
        ];

        if (automatedSubjects.some(sub => subjectLower.includes(sub))) {
            return false;
        }

        // 3. Length check - very short messages might not need AI response
        if (message.body.length < 10) return false;

        return true;
    },

    /**
     * Generate an autonomous response using AI
     */
    async generateAutonomousResponse(message: EmailMessage): Promise<{ subject: string; body: string } | null> {
        if (!this.shouldAutoRespond(message)) return null;

        const prompt = `You are a professional business assistant for AlphaClone Systems. 
Draft a professional, helpful, and concise response to the following email from ${message.from}.

Email Subject: ${message.subject}
Email Content:
${message.body}

Guidelines:
- Maintain a premium, professional tone.
- Be helpful and address the sender's points.
- If it's a sales inquiry, be welcoming.
- If it's a support request, offer assistance.
- Keep it brief (under 150 words).

Return the response in JSON format with "subject" and "body" keys.`;

        try {
            const response = await aiService.complete({
                prompt,
                systemPrompt: 'You are a professional inbox manager. You respond autonomously to professional business inquiries.',
                temperature: 0.7,
            });

            const parsed = JSON.parse(response.content);
            return {
                subject: parsed.subject || `Re: ${message.subject}`,
                body: parsed.body
            };
        } catch (err) {
            console.error('AI Response Generation Failed:', err);
            return null;
        }
    },

    /**
     * Process inbox for a user and provider
     */
    async processInbox(userId: string, provider: 'gmail' | 'zoho'): Promise<{ processed: number; responded: number; error: string | null }> {
        let processed = 0;
        let responded = 0;

        try {
            let messages: any[] = [];

            if (provider === 'gmail') {
                const { threads } = await gmailService.listThreads(userId, 10);
                messages = threads.map(t => ({ ...t, provider: 'gmail' }));
            } else {
                const { messages: zohoMsgs } = await zohoService.listMessages(userId);
                messages = zohoMsgs.map(m => ({ ...m, provider: 'zoho' }));
            }

            for (const msg of messages) {
                processed++;
                const emailMsg: EmailMessage = {
                    id: msg.id,
                    threadId: msg.threadId,
                    from: msg.from || '',
                    subject: msg.subject || '',
                    body: msg.body || msg.snippet || '',
                    provider: provider,
                    date: msg.date || new Date().toISOString()
                };

                const response = await this.generateAutonomousResponse(emailMsg);
                if (response) {
                    // Send the response
                    if (provider === 'gmail') {
                        await gmailService.sendMessage(userId, emailMsg.from, response.subject, response.body, emailMsg.threadId);
                    } else {
                        await zohoService.sendMessage(userId, emailMsg.from, response.subject, response.body);
                    }
                    responded++;
                }
            }

            return { processed, responded, error: null };
        } catch (err: any) {
            return { processed, responded, error: err.message };
        }
    }
};
