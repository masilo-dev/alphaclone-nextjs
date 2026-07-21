import { cleanupRealtimeChannel } from '../lib/realtime';
import { supabase } from '../lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface Notification {
    id: string;
    user_id: string;
    tenant_id: string;
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
    tenant_id: string;
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
    async getNotifications(userId: string, tenantId: string, limit = 50) {
        const response = await fetch(`/api/notifications?tenantId=${encodeURIComponent(tenantId)}`, {
            cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { notifications: [], error: payload.error || 'Notifications could not be loaded' };
        }
        const notifications = ((payload.notifications as Notification[]) || [])
            .filter((n) => n.user_id === userId)
            .slice(0, limit)
            .map((n: any) => ({
                ...n,
                link: n.link ?? n.action_url ?? undefined,
            }));
        return { notifications, error: undefined };
    },

    async getUnreadCount(userId: string, tenantId: string) {
        const { notifications, error } = await this.getNotifications(userId, tenantId, 100);
        if (error) return { count: 0, error };
        return { count: notifications.filter((n) => !n.read).length, error: undefined };
    },

    async markAsRead(notificationId: string) {
        const tenantId =
            typeof window !== 'undefined'
                ? (await import('./tenancy/TenantService')).tenantService.getCurrentTenantId()
                : null;
        if (!tenantId) return { error: 'No active workspace selected' };
        const response = await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, ids: [notificationId], read: true }),
        });
        const payload = await response.json().catch(() => ({}));
        return { error: response.ok ? undefined : payload.error || 'Notification could not be updated' };
    },

    async markAllAsRead(userId: string, tenantId: string) {
        const { notifications, error: loadError } = await this.getNotifications(userId, tenantId, 200);
        if (loadError) return { error: loadError };
        const ids = notifications.filter((n) => !n.read).map((n) => n.id);
        if (!ids.length) return { error: undefined };
        const response = await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, ids, read: true }),
        });
        const payload = await response.json().catch(() => ({}));
        return { error: response.ok ? undefined : payload.error || 'Notifications could not be updated' };
    },

    async deleteNotification(notificationId: string) {
        const tenantId =
            typeof window !== 'undefined'
                ? (await import('./tenancy/TenantService')).tenantService.getCurrentTenantId()
                : null;
        if (!tenantId) return { error: 'No active workspace selected' };
        const response = await fetch(
            `/api/notifications?tenantId=${encodeURIComponent(tenantId)}&notificationId=${encodeURIComponent(notificationId)}`,
            { method: 'DELETE' }
        );
        const payload = await response.json().catch(() => ({}));
        return { error: response.ok ? undefined : payload.error || 'Notification could not be deleted' };
    },

    async createNotification(notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('notifications')
            .insert(notification)
            .select()
            .single();

        return { notification: data, error };
    },

    subscribeToNotifications(userId: string, tenantId: string, callback: (notification: Notification) => void) {
        const channel = supabase
            .channel(`notifications:${userId}:${tenantId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`, // Note: Realtime filter only supports one column usually, but we check tenant in client if needed. However, since we filter by user_id AND it's a private channel name, it's safer.
                },
                (payload: RealtimePostgresChangesPayload<Notification>) => {
                    if (payload.new && 'tenant_id' in payload.new && payload.new.tenant_id === tenantId) {
                        const row = payload.new as any;
                        callback({ ...row, link: row.link ?? row.action_url ?? undefined } as Notification);
                    }
                }
            )
            .subscribe();

        return () => {
            cleanupRealtimeChannel(channel);
        };
    },
};

export const activityService = {
    async getActivityLogs(userId: string, tenantId: string, limit = 100) {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(limit);

        return { logs: data, error };
    },

    async logActivity(userId: string, action: string, metadata: any = {}, tenantId?: string) {
        const { data, error } = await supabase
            .from('activity_logs')
            .insert({
                user_id: userId,
                tenant_id: tenantId,
                action: action,
                metadata: metadata
            })
            .select()
            .single();

        return { log: data, error };
    },

    async getRecentActivity(userId: string, tenantId: string, hours = 24) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('tenant_id', tenantId)
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
            .maybeSingle();

        return { preferences: data, error };
    },

    async updatePreferences(userId: string, preferences: Partial<UserPreferences>) {
        const { data, error } = await supabase
            .from('user_preferences')
            .upsert({ user_id: userId, ...preferences }, { onConflict: 'user_id' })
            .select()
            .single();

        return { preferences: data, error };
    },

    async updateTheme(userId: string, theme: 'light' | 'dark' | 'auto') {
        return this.updatePreferences(userId, { theme });
    },

    async updateLanguage(userId: string, language: string) {
        const { preferences } = await this.getPreferences(userId);
        const layout = { ...(preferences?.dashboard_layout || {}), ui_language: language };
        return this.updatePreferences(userId, { dashboard_layout: layout });
    },
};
