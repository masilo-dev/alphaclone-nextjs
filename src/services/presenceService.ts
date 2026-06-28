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

    private isMissingRpc(error: { code?: string; message?: string } | null | undefined): boolean {
        if (!error) return false;
        const message = String(error.message || '').toLowerCase();
        return (
            error.code === 'PGRST202' ||
            error.code === '42883' ||
            message.includes('could not find the function') ||
            message.includes('schema cache')
        );
    }

    private isPresenceAuthError(error: { message?: string } | null | undefined): boolean {
        const message = String(error?.message || '').toLowerCase();
        return message.includes('not authorized to update this presence record');
    }

    private async resolvePresenceUserId(userId: string): Promise<string | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        return user.id === userId ? userId : user.id;
    }

    private markUnsupported(): void {
        this.presenceSupported = false;
        this.stopHeartbeat();
    }

    /**
     * Initialize presence tracking for current user
     */
    async initializePresence(userId: string, status: PresenceStatus = 'online'): Promise<{ error: string | null }> {
        if (this.presenceSupported === false) {
            return { error: null };
        }

        try {
            const resolvedUserId = await this.resolvePresenceUserId(userId);
            if (!resolvedUserId) return { error: null };

            const { error } = await supabase.rpc('update_user_presence', {
                p_user_id: resolvedUserId,
                p_status: status,
                p_device_info: {
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                },
            });

            if (error) {
                if (this.isMissingRpc(error) || this.isPresenceAuthError(error)) {
                    this.markUnsupported();
                    return { error: null };
                }
                return { error: error.message };
            }

            this.presenceSupported = true;
            this.activeUserId = resolvedUserId;
            this.startHeartbeat(resolvedUserId);
            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to initialize presence' };
        }
    }

    private startHeartbeat(userId: string): void {
        this.stopHeartbeat();

        const updateActivityTime = () => {
            this.lastActivityTime = Date.now();
        };

        window.addEventListener('mousemove', updateActivityTime, { passive: true });
        window.addEventListener('keydown', updateActivityTime, { passive: true });
        window.addEventListener('click', updateActivityTime, { passive: true });
        window.addEventListener('scroll', updateActivityTime, { passive: true });

        this.heartbeatInterval = setInterval(async () => {
            if (this.presenceSupported === false) return;

            try {
                const idleTime = Date.now() - this.lastActivityTime;
                const isIdle = idleTime > 5 * 60 * 1000;
                const nextStatus = isIdle ? 'away' : 'online';

                const { error } = await supabase.rpc('update_user_presence', {
                    p_user_id: userId,
                    p_status: nextStatus,
                    p_device_info: null,
                });

                if (error && (this.isMissingRpc(error) || this.isPresenceAuthError(error))) {
                    this.markUnsupported();
                }
            } catch {
                // Heartbeat failures are non-critical
            }
        }, this.HEARTBEAT_INTERVAL);

        window.addEventListener('focus', () => {
            void this.updatePresence(userId, 'online');
        });

        window.addEventListener('beforeunload', () => {
            void this.updatePresence(userId, 'offline');
        });
    }

    stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    async updatePresence(
        userId: string,
        status: PresenceStatus,
    ): Promise<{ error: string | null }> {
        if (this.presenceSupported === false) {
            return { error: null };
        }

        try {
            const resolvedUserId = await this.resolvePresenceUserId(userId);
            if (!resolvedUserId) return { error: null };

            const { error } = await supabase.rpc('update_user_presence', {
                p_user_id: resolvedUserId,
                p_status: status,
                p_device_info: null,
            });

            if (error) {
                if (this.isMissingRpc(error) || this.isPresenceAuthError(error)) {
                    this.markUnsupported();
                    return { error: null };
                }
                return { error: error.message };
            }

            this.presenceSupported = true;
            this.activeUserId = resolvedUserId;
            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to update presence' };
        }
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
        this.stopHeartbeat();
        await this.updatePresence(userId, 'offline');
        if (this.activeUserId === userId) {
            this.activeUserId = null;
        }
    }
}

export const presenceService = new PresenceService();
