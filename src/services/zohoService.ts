import { supabase } from '../lib/supabase';

export interface ZohoMessage {
    id: string;
    threadId: string;
    subject: string;
    snippet: string;
    from: string;
    to: string;
    date: string;
    body?: string;
    hasAttachments: boolean;
}

export const zohoService = {
    /**
     * Check if user has Zoho integrated
     */
    async checkIntegration(userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('integrations')
            .select('id, enabled')
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .eq('enabled', true)
            .maybeSingle();

        return !!data && !error;
    },

    /**
     * Get Zoho configuration for user
     */
    async getConfig(userId: string): Promise<any> {
        const { data, error } = await supabase
            .from('integrations')
            .select('config')
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .single();

        if (error) return null;
        return data.config;
    },

    async listMessages(folderId: string = 'inbox'): Promise<{ messages: ZohoMessage[]; error: string | null }> {
        try {
            const response = await fetch(`/api/zoho?action=get_messages&folder=${folderId}`);
            if (!response.ok) throw new Error('Failed to fetch Zoho messages');

            const data = await response.json();
            return { messages: data.data || [], error: null };
        } catch (err: any) {
            console.error('Zoho ListMessages Error:', err);
            return { messages: [], error: err.message };
        }
    },

    /**
     * Send message via Zoho
     */
    async sendMessage(to: string, subject: string, content: string, fromAddress?: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const response = await fetch('/api/zoho', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'send_email', 
                    data: { to, subject, content, fromAddress } 
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send Zoho message');
            }

            return { success: true, error: null };
        } catch (err: any) {
            console.error('Zoho SendMessage Error:', err);
            return { success: false, error: err.message };
        }
    }
};
