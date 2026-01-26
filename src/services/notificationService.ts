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
        return supabase
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
            .subscribe();
    }
};
