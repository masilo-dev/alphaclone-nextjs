import { supabase } from '@/lib/supabase';
<<<<<<< HEAD
=======
import { emailService } from './emailService';
import { tenantService } from '../tenancy/TenantService';
>>>>>>> origin/main

export interface UnifiedMessage {
    id: string;
    provider: 'gmail' | 'zoho' | 'internal';
    threadId?: string;
    from: string;
    to: string[];
    subject: string;
    snippet: string;
    body?: string;
    date: string;
    isRead: boolean;
    labels: string[];
}

export const UnifiedEmailService = {
    /**
     * Detects which email providers are connected for the current user/tenant
     */
    async getConnectedProviders(userId: string) {
        const { data: integrations } = await supabase
            .from('integrations')
            .select('type')
            .eq('user_id', userId);
        
        const providers = {
            gmail: integrations?.some((i: any) => i.type === 'gmail') || false,
            custom_smtp: integrations?.some((i: any) => i.type === 'custom_smtp') || false,
            zoho: !!(process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID), // Simplistic check
        };
        
        return providers;
    },

    /**
     * Lists messages across all connected providers
     */
    async listMessages(userId: string, limit = 20): Promise<UnifiedMessage[]> {
        const providers = await this.getConnectedProviders(userId);
        let allMessages: UnifiedMessage[] = [];

        if (providers.gmail) {
            try {
                const res = await fetch(`/api/gmail/messages?userId=${userId}&limit=${limit}`);
                const data = await res.json();
                if (data.messages) {
                    allMessages = [...allMessages, ...data.messages.map((m: any) => ({
                        ...m,
                        provider: 'gmail' as const
                    }))];
                }
            } catch (err) {
                console.error('Failed to fetch Gmail messages:', err);
            }
        }

        // Add Zoho and other providers here...

        return allMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    /**
     * Uses AI to triage incoming emails across all providers
     */
    async triageInbox(tenantId: string) {
        try {
            const response = await fetch('/api/social/command-center', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    tenantId, 
                    mode: 'nexus_system_action', 
                    systemKey: 'email_triage' 
                })
            });
            return await response.json();
        } catch (error) {
            console.error('AI Triage Error:', error);
            return { success: false, error: 'AI Triage failed' };
        }
    },

    /**
     * Generates a draft response using AI
     */
    async generateDraft(messageId: string, provider: string, context?: string) {
        // This would call an AI endpoint with the message content
        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Draft a professional response to email ${messageId} on ${provider}. Context: ${context || 'General follow-up'}`
                })
            });
            return await response.json();
        } catch (error) {
            console.error('AI Draft Error:', error);
            return { success: false, error: 'Draft generation failed' };
        }
    },

    /**
     * Uses AI to summarize an entire email thread
     */
    async summarizeThread(threadId: string, messages: any[]) {
        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Summarize this email thread (Thread ID: ${threadId}). Focus on key action items and sentiment.\n\nMessages:\n${JSON.stringify(messages.map(m => ({ from: m.from, body: m.snippet || m.body?.slice(0, 500) })))}`
                })
            });
            const data = await response.json();
            return { success: true, summary: data.result };
        } catch (error) {
            console.error('AI Summary Error:', error);
            return { success: false, error: 'Summary failed' };
        }
    }
};
