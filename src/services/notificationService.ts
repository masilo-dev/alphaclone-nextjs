import { supabase } from '../lib/supabase';

export interface Notification {
    id: string;
    userId: string;
    type: 'message' | 'project' | 'payment' | 'system' | 'alert' | 'task';
    title: string;
    message?: string;
    read: boolean;
    link?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    metadata: Record<string, any>;
    created_at: string;
}

export const notificationService = {
    async sendNotification(params: {
        userId: string;
        type: 'message' | 'project' | 'payment' | 'system' | 'alert' | 'task';
        title: string;
        message?: string;
        link?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        metadata?: Record<string, any>;
    }) {
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: params.userId,
                type: params.type,
                title: params.title,
                message: params.message,
                link: params.link,
                priority: params.priority || 'medium',
                metadata: params.metadata || {},
                read: false
            });

        return { success: !error, error: error?.message };
    },

    async getNotifications(userId: string) {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        return { notifications: data as Notification[] || [], error: error?.message };
    },

    async markAsRead(notificationId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);

        return { error: error?.message };
    },

    async markAllAsRead(userId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId);

        return { error: error?.message };
    },

    async deleteNotification(notificationId: string) {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);

        return { error: error?.message };
    },

    // Subscribe to realtime notifications
    subscribe(userId: string, callback: (notification: Notification) => void) {
        const channel = supabase
            .channel(`notifications:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId.trim()}`
                },
                (payload: any) => {
                    callback(payload.new as Notification);
                }
            )
            .subscribe((status: string, err?: Error) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Subscribed to real-time notifications');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Notification subscription error:', err?.message || 'Unknown error');
                } else if (status === 'TIMED_OUT') {
                    console.error('❌ Notification subscription timed out - retrying in 5s...');
                    setTimeout(() => notificationService.subscribe(userId, callback), 5000);
                }
            });

        return channel;
    },

    /**
     * AI-Powered Smart Notification
     * Generates a concise, high-impact summary of a task or event
     */
    async sendSmartNotification(params: {
        userId: string;
        type: 'task' | 'project' | 'alert';
        title: string;
        rawContext: string;
        link?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
    }) {
        try {
            const { generateText } = await import('./unifiedAIService');
            const prompt = `You are a high-performance productivity assistant. 
            Summarize the following context into a single, punchy, actionable notification sentence (max 15 words).
            
            CONTEXT: "${params.rawContext}"
            
            STRICT RULES:
            - No markdown.
            - No generic "You have a new task".
            - Focus on the "What" and "Why".`;

            const { text: summary } = await generateText(prompt, 100);
            
            return await this.sendNotification({
                userId: params.userId,
                type: params.type,
                title: params.title,
                message: summary || params.rawContext.substring(0, 100),
                link: params.link,
                priority: params.priority,
                metadata: { aiGenerated: true, originalContext: params.rawContext }
            });
        } catch (err) {
            // Fallback to standard notification
            return await this.sendNotification({
                userId: params.userId,
                type: params.type,
                title: params.title,
                message: params.rawContext.substring(0, 100),
                link: params.link,
                priority: params.priority
            });
        }
    },

    unsubscribe(channel: any) {
        supabase.removeChannel(channel);
    }
};
