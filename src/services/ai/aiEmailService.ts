import { routeAIRequest } from '@/services/aiRouter';
import { gmailService } from '../gmailService';
import { buildBusinessReplyPrompt } from '@/lib/ai/businessContext';


export interface EmailMessage {
    id: string;
    threadId: string;
    from: string;
    subject: string;
    body: string;
    provider: 'gmail';
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
            'support@github.com', 'google.com', 'microsoft.com',
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

            const prompt = buildBusinessReplyPrompt({
                sender: { name: message.from },
                recipient: { name: 'AlphaClone team' },
                subject: message.subject,
                message: message.body,
                channel: 'email',
                context: 'Draft the reply as a concise professional response. If the sender asks a question, answer it directly. If more details are needed, ask one clear follow-up question.',
            });

            try {
            const response = await routeAIRequest({
                prompt,
                systemPrompt: 'You are a professional inbox manager. You respond autonomously to professional business inquiries.',
                temperature: 0.5,
                maxTokens: 400,
            });

            const content = response.content.trim();
            const parsed = content.startsWith('{') ? JSON.parse(content) : null;
            return {
                subject: parsed?.subject || `Re: ${message.subject}`,
                body: parsed?.body || content
            };
        } catch (err) {
            console.error('AI Response Generation Failed:', err);
            return null;
        }
    },

    async processInbox(userId: string, provider: 'gmail'): Promise<{ processed: number; responded: number; error: string | null }> {
        let processed = 0;
        let responded = 0;

        try {
            let messages: any[] = [];

            if (provider === 'gmail') {
                const { threads } = await gmailService.listThreads(userId, 10);
                messages = threads.map(t => ({ ...t, provider: 'gmail' }));
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
                    }
                    responded++;
                }
            }

            return { processed, responded, error: null };
        } catch (err: any) {
            console.error('Inbox Processing Error:', err);
            return { processed, responded, error: err.message };
        }
    }
};
