import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface Notification {
    id: string;
    userId: string;
    type: 'contact' | 'project' | 'message' | 'system';
    title: string;
    message: string;
    read: boolean;
    createdAt: Date;
}

export const notificationService = {
    /**
     * Get user notifications
     */
    async getNotifications(userId: string): Promise<{ notifications: Notification[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                return { notifications: [], error: error.message };
            }

            const notifications: Notification[] = (data || []).map((n: any) => ({
                id: n.id,
                userId: n.user_id,
                type: n.type,
                title: n.title,
                message: n.message,
                read: n.read,
                createdAt: new Date(n.created_at),
            }));

            return { notifications, error: null };
        } catch (err) {
            return { notifications: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', notificationId)
                .eq('tenant_id', tenantService.getCurrentTenantId());

            return { error: error ? error.message : null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', userId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .eq('read', false);

            return { error: error ? error.message : null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Subscribe to real-time notifications
     */
    subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
        const channel = supabase
            .channel(`notifications:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId} AND tenant_id=eq.${tenantService.getCurrentTenantId()}`,
                },
                (payload: any) => {
                    const n = payload.new;
                    const notification: Notification = {
                        id: n.id,
                        userId: n.user_id,
                        type: n.type,
                        title: n.title,
                        message: n.message,
                        read: n.read,
                        createdAt: new Date(n.created_at),
                    };
                    callback(notification);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },

    /**
     * Delete notification
     */
    async deleteNotification(notificationId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId)
                .eq('tenant_id', tenantService.getCurrentTenantId());

            return { error: error ? error.message : null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },
};
