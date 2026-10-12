import { cleanupRealtimeChannel } from '../lib/realtime';
import { supabase } from '../lib/supabase';

/**
 * Presence Service
 * Handles real-time user online/offline status tracking (MS Teams-like)
 */

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface UserPresence {
    user_id: string;
    status: PresenceStatus;
    last_seen: string;
    name?: string;
    email?: string;
    avatar_url?: string;
    role?: string;
}

class PresenceService {
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_INTERVAL = 180000;
    private lastActivityTime: number = Date.now();
    private presenceSupported: boolean | null = null;
    private activeUserId: string | null = null;

    private owners = 0;
    private cleanupListeners: (() => void) | null = null;
    private updateInFlight: Promise<{ error: string | null }> | null = null;
    private retryAt = 0;
    private failures = 0;

    private isMissingRpc(error: { code?: string; message?: string } | null | undefined): boolean {
        return !!error && (error.code === 'PGRST202' || error.code === '42883');
    }
    private isTransientDbError(error: { code?: string; message?: string } | null | undefined): boolean {
        return !!error && (['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003', '57014', '53300'].includes(error.code || '') || /503|service unavailable|timeout|timed out|network|fetch/i.test(error.message || ''));
    }
    private isPresenceAuthError(error: { message?: string } | null | undefined): boolean {
        return /not authorized to update this presence record/i.test(error?.message || '');
    }
    private markUnsupported(): void { this.presenceSupported = false; this.stopHeartbeat(); }

    async initializePresence(userId: string, status: PresenceStatus = 'online'): Promise<{ error: string | null }> {
        this.owners++;
        this.activeUserId = userId;
        const result = await this.updatePresence(userId, status);
        // A cleanup may happen while the initial RPC is pending.
        if (this.owners > 0 && this.presenceSupported !== false && this.activeUserId) this.startHeartbeat(this.activeUserId);
        return result;
    }

    private startHeartbeat(userId: string): void {
        this.stopHeartbeat();
        const updateActivityTime = () => { this.lastActivityTime = Date.now(); };
        const onVisible = () => {
            if (document.visibilityState === 'visible') void this.updatePresence(userId, 'online');
        };
        const onFocus = () => onVisible();
        const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'] as const;
        for (const event of activityEvents) window.addEventListener(event, updateActivityTime, { passive: true });
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisible);
        this.cleanupListeners = () => {
            for (const event of activityEvents) window.removeEventListener(event, updateActivityTime);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisible);
        };
        this.heartbeatInterval = setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            const nextStatus = Date.now() - this.lastActivityTime > 5 * 60_000 ? 'away' : 'online';
            void this.updatePresence(userId, nextStatus);
        }, this.HEARTBEAT_INTERVAL);
    }

    stopHeartbeat(): void {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
        this.cleanupListeners?.();
        this.cleanupListeners = null;
    }

    async updatePresence(userId: string, status: PresenceStatus): Promise<{ error: string | null }> {
        if (this.presenceSupported === false || Date.now() < this.retryAt) return { error: null };
        if (status !== 'offline' && typeof document !== 'undefined' && document.visibilityState !== 'visible') return { error: null };
        if (this.updateInFlight) return this.updateInFlight;
        const execute = async () => {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError) throw authError;
                if (!user || user.id !== userId) return { error: 'Presence session is unavailable.' };
                this.activeUserId = user.id;
                const { error } = await supabase.rpc('update_user_presence', {
                    p_user_id: user.id, p_status: status, p_device_info: null,
                });
                if (error) throw error;
                this.failures = 0; this.retryAt = 0; this.presenceSupported = true;
                return { error: null };
            } catch (error) {
                const failure = error as { code?: string; message?: string };
                if (this.isMissingRpc(failure) || this.isPresenceAuthError(failure)) this.markUnsupported();
                else {
                    this.failures++;
                    this.retryAt = Date.now() + Math.min(300_000, 30_000 * 2 ** (this.failures - 1)) + Math.floor(Math.random() * 5_000);
                }
                return { error: this.isTransientDbError(failure) ? 'Presence is temporarily unavailable; business workflows remain available.' : failure.message || 'Presence update failed' };
            }
        };
        this.updateInFlight = execute();
        try { return await this.updateInFlight; }
        finally { this.updateInFlight = null; }
    }

    async getOnlineUsers(excludeUserId?: string): Promise<{ users: UserPresence[]; error: string | null }> {
        if (this.presenceSupported === false) {
            return { users: [], error: null };
        }

        try {
            const { data, error } = await supabase.rpc('get_online_users', {
                p_exclude_user_id: excludeUserId || null,
            });

            if (error) {
                if (this.isMissingRpc(error)) {
                    this.markUnsupported();
                    return { users: [], error: null };
                }
                return { users: [], error: error.message };
            }

            return { users: data || [], error: null };
        } catch (err) {
            return { users: [], error: err instanceof Error ? err.message : 'Failed to get online users' };
        }
    }

    async getUserPresence(userId: string): Promise<{ presence: UserPresence | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('user_presence')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return {
                        presence: {
                            user_id: userId,
                            status: 'offline',
                            last_seen: new Date().toISOString(),
                        },
                        error: null,
                    };
                }
                if (error.code === 'PGRST205' || String(error.message || '').includes('user_presence')) {
                    return { presence: null, error: null };
                }
                return { presence: null, error: error.message };
            }

            return { presence: data, error: null };
        } catch (err) {
            return { presence: null, error: err instanceof Error ? err.message : 'Failed to get user presence' };
        }
    }

    subscribeToPresence(onPresenceChange: (presence: UserPresence) => void): () => void {
        if (this.presenceSupported === false) {
            return () => undefined;
        }

        const channel = supabase
            .channel('user-presence-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_presence',
                },
                (payload: any) => {
                    if (payload.new) {
                        onPresenceChange(payload.new as UserPresence);
                    }
                }
            )
            .subscribe();

        return () => {
            cleanupRealtimeChannel(channel);
        };
    }

    subscribeToUserPresence(userId: string, onPresenceChange: (presence: UserPresence) => void): () => void {
        if (this.presenceSupported === false) {
            return () => undefined;
        }

        const channel = supabase
            .channel(`user-presence-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_presence',
                    filter: `user_id=eq.${userId}`,
                },
                (payload: any) => {
                    if (payload.new) {
                        onPresenceChange(payload.new as UserPresence);
                    }
                }
            )
            .subscribe();

        return () => {
            cleanupRealtimeChannel(channel);
        };
    }

    isUserOnline(presence: UserPresence): boolean {
        if (presence.status === 'offline') return false;

        const lastSeen = new Date(presence.last_seen);
        const now = new Date();
        const diffMinutes = (now.getTime() - lastSeen.getTime()) / 1000 / 60;

        return diffMinutes < 5 && ['online', 'away', 'busy'].includes(presence.status);
    }

    async cleanup(userId: string): Promise<void> {
        this.owners = Math.max(0, this.owners - 1);
        if (this.owners > 0) return;
        this.stopHeartbeat();
        if (this.updateInFlight) await this.updateInFlight;
        if (this.owners > 0) return;
        await this.updatePresence(userId, 'offline');
        if (this.owners === 0 && this.activeUserId === userId) this.activeUserId = null;
    }
}

export const presenceService = new PresenceService();
