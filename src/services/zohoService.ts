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
     * Get full message content (HTML)
     */
    async getMessageContent(messageId: string, folderId: string = 'inbox'): Promise<string | null> {
        try {
            const response = await fetch(`/api/zoho?action=get_message_content&messageId=${messageId}&folderId=${folderId}`);
            if (!response.ok) throw new Error('Failed to fetch Zoho message content');
            const data = await response.json();
            return data.data?.content || null;
        } catch (err) {
            console.error('Zoho getMessageContent Error:', err);
            return null;
        }
    },

    /**
     * Get attachment info for a message
     */
    async getAttachmentInfo(messageId: string, folderId: string = 'inbox'): Promise<any[]> {
        try {
            const response = await fetch(`/api/zoho?action=get_attachment_info&messageId=${messageId}&folderId=${folderId}`);
            if (!response.ok) throw new Error('Failed to fetch Zoho attachment info');
            const data = await response.json();
            return data.data || [];
        } catch (err) {
            console.error('Zoho getAttachmentInfo Error:', err);
            return [];
        }
    },

    /**
     * Download an attachment
     */
    async downloadAttachment(messageId: string, attachmentId: string, fileName: string) {
        try {
            const response = await fetch(`/api/zoho?action=download_attachment&messageId=${messageId}&attachmentId=${attachmentId}`);
            if (!response.ok) throw new Error('Failed to download Zoho attachment');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Zoho downloadAttachment Error:', err);
        }
    },

    /**
     * Upload an attachment
     */
    async uploadAttachment(file: File): Promise<string | null> {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch('/api/zoho', {
                method: 'POST',
                // Browser handles Content-Type with boundary automatically
                body: formData
            });
            if (!response.ok) throw new Error('Failed to upload Zoho attachment');
            const data = await response.json();
            // Zoho V1 returns attachmentId in various forms; mapping to 'attachmentId'
            return data.data?.attachmentId || data.data?.id || null;
        } catch (err) {
            console.error('Zoho uploadAttachment Error:', err);
            return null;
        }
    },

    /**
     * Update message status (Read/Unread/Star)
     */
    async updateStatus(messageId: string, mode: 'markAsRead' | 'markAsUnread' | 'setFlag', params: any = {}): Promise<boolean> {
        try {
            const response = await fetch('/api/zoho', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'update_message', 
                    data: { messageId, mode, params } 
                })
            });
            return response.ok;
        } catch (err) {
            console.error('Zoho updateStatus Error:', err);
            return false;
        }
    },

    /**
     * Mark as spam
     */
    async markAsSpam(messageId: string): Promise<boolean> {
        try {
            const response = await fetch('/api/zoho', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'mark_spam', 
                    data: { messageId } 
                })
            });
            return response.ok;
        } catch (err) {
            console.error('Zoho markAsSpam Error:', err);
            return false;
        }
    },

    /**
     * List all labels
     */
    async listLabels(): Promise<any[]> {
        try {
            const response = await fetch('/api/zoho?action=list_labels');
            if (!response.ok) throw new Error('Failed to fetch Zoho labels');
            const data = await response.json();
            return data.data || [];
        } catch (err) {
            console.error('Zoho listLabels Error:', err);
            return [];
        }
    },

    /**
     * Send message via Zoho
     */
    async sendMessage(data: {
        to: string;
        subject: string;
        content: string;
        fromAddress?: string;
        cc?: string;
        bcc?: string;
        attachmentIds?: string[];
    }): Promise<{ success: boolean; error: string | null }> {
        try {
            const response = await fetch('/api/zoho', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'send_email', 
                    data: {
                        to: data.to,
                        subject: data.subject,
                        content: data.content,
                        fromAddress: data.fromAddress,
                        ccAddress: data.cc,
                        bccAddress: data.bcc,
                        attachmentIds: data.attachmentIds
                    } 
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
