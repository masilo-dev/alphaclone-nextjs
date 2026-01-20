import { supabase } from '../lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface Notification {
    id: string;
    user_id: string;
    type: 'message' | 'project' | 'payment' | 'system' | 'alert';
    title: string;
    message?: string;
    read: boolean;
    link?: string;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface ActivityLog {
    id: string;
    user_id: string;
    action: string;
    entity_type?: 'project' | 'message' | 'payment' | 'contract' | 'user' | 'system';
    entity_id?: string;
    metadata?: Record<string, any>;
    created_at: string;
}

export interface Favorite {
    id: string;
    user_id: string;
    entity_type: 'project' | 'message' | 'document' | 'contact';
    entity_id: string;
    created_at: string;
}

export interface UserPreferences {
    id: string;
    user_id: string;
    theme: 'light' | 'dark' | 'auto';
    notifications_enabled: boolean;
    email_notifications: boolean;
    dashboard_layout?: Record<string, any>;
    quick_actions?: string[];
    created_at: string;
    updated_at: string;
}

export const notificationService = {
    async getNotifications(userId: string, limit = 50) {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        return { notifications: data, error };
    },

    async getUnreadCount(userId: string) {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('read', false);

        return { count: count || 0, error };
    },

    async markAsRead(notificationId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);

        return { error };
    },

    async markAllAsRead(userId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false);

        return { error };
    },

    async deleteNotification(notificationId: string) {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);

        return { error };
    },

    async createNotification(notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('notifications')
            .insert(notification)
            .select()
            .single();

        return { notification: data, error };
    },

    subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
        const subscription = supabase
            .channel('notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload: RealtimePostgresChangesPayload<Notification>) => {
                    callback(payload.new as Notification);
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    },
};

export const activityService = {
    async getActivityLogs(userId: string, limit = 100) {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        return { logs: data, error };
    },

    async logActivity(log: Omit<ActivityLog, 'id' | 'created_at'>) {
        const { data, error } = await supabase
            .from('activity_logs')
            .insert(log)
            .select()
            .single();

        return { log: data, error };
    },

    async getRecentActivity(userId: string, hours = 24) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', since)
            .order('created_at', { ascending: false });

        return { logs: data, error };
    },
};

export const favoritesService = {
    async getFavorites(userId: string) {
        const { data, error } = await supabase
            .from('favorites')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        return { favorites: data, error };
    },

    async addFavorite(favorite: Omit<Favorite, 'id' | 'created_at'>) {
        const { data, error } = await supabase
            .from('favorites')
            .insert(favorite)
            .select()
            .single();

        return { favorite: data, error };
    },

    async removeFavorite(favoriteId: string) {
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('id', favoriteId);

        return { error };
    },

    async isFavorite(userId: string, entityType: string, entityId: string) {
        const { data, error } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', userId)
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .single();

        return { isFavorite: !!data, error };
    },
};

export const preferencesService = {
    async getPreferences(userId: string) {
        const { data, error } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();

        return { preferences: data, error };
    },

    async updatePreferences(userId: string, preferences: Partial<UserPreferences>) {
        const { data, error } = await supabase
            .from('user_preferences')
            .upsert({ user_id: userId, ...preferences })
            .select()
            .single();

        return { preferences: data, error };
    },

    async updateTheme(userId: string, theme: 'light' | 'dark' | 'auto') {
        return this.updatePreferences(userId, { theme });
    },
};
