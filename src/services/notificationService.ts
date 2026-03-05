import { supabase } from '../lib/supabase';

export interface Notification {
    id: string;
    userId: string;
    type: 'message' | 'project' | 'payment' | 'system' | 'alert';
    title: string;
    message?: string;
    read: boolean;
    link?: string;
    created_at: string;
}

export const notificationService = {
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
                    filter: `user_id=eq.${userId}`
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

    unsubscribe(channel: any) {
        supabase.removeChannel(channel);
    }
};
