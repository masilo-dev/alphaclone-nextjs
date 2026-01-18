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
    private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

    /**
     * Initialize presence tracking for current user
     */
    async initializePresence(userId: string, status: PresenceStatus = 'online'): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase.rpc('update_user_presence', {
                p_user_id: userId,
                p_status: status,
                p_device_info: {
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                }
            });

            if (error) {
                console.error('Failed to initialize presence:', error);
                return { error: error.message };
            }

            // Start heartbeat to keep presence updated
            this.startHeartbeat(userId);

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to initialize presence' };
        }
    }

    /**
     * Start heartbeat to keep presence alive
     */
    private startHeartbeat(userId: string): void {
        // Clear any existing heartbeat
        this.stopHeartbeat();

        // Send heartbeat every 30 seconds
        this.heartbeatInterval = setInterval(async () => {
            try {
                await supabase.rpc('update_user_presence', {
                    p_user_id: userId,
                    p_status: 'online',
                    p_device_info: null
                });
            } catch (err) {
                console.error('Heartbeat failed:', err);
            }
        }, this.HEARTBEAT_INTERVAL);

        // Update presence when window regains focus
        window.addEventListener('focus', () => {
            this.updatePresence(userId, 'online');
        });

        // Mark as away when window loses focus (optional)
        window.addEventListener('blur', () => {
            // Optional: mark as away when user switches tabs
            // this.updatePresence(userId, 'away');
        });

        // Update to offline before page unload
        window.addEventListener('beforeunload', () => {
            this.updatePresence(userId, 'offline', false);
        });
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Update user presence status
     */
    async updatePresence(
        userId: string,
        status: PresenceStatus,
        useBeacon: boolean = true
    ): Promise<{ error: string | null }> {
        try {
            if (useBeacon && status === 'offline') {
                // Use sendBeacon for offline status (works even if page is closing)
                const url = `${supabase.supabaseUrl}/rest/v1/rpc/update_user_presence`;
                const data = JSON.stringify({
                    p_user_id: userId,
                    p_status: status,
                    p_device_info: null
                });

                navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
                return { error: null };
            }

            const { error } = await supabase.rpc('update_user_presence', {
                p_user_id: userId,
                p_status: status,
                p_device_info: null
            });

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to update presence' };
        }
    }

    /**
     * Get online users
     */
    async getOnlineUsers(excludeUserId?: string): Promise<{ users: UserPresence[]; error: string | null }> {
        try {
            const { data, error } = await supabase.rpc('get_online_users', {
                p_exclude_user_id: excludeUserId || null
            });

            if (error) {
                return { users: [], error: error.message };
            }

            return { users: data || [], error: null };
        } catch (err) {
            return { users: [], error: err instanceof Error ? err.message : 'Failed to get online users' };
        }
    }

    /**
     * Get user presence by ID
     */
    async getUserPresence(userId: string): Promise<{ presence: UserPresence | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('user_presence')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // User has no presence record yet, return offline
                    return {
                        presence: {
                            user_id: userId,
                            status: 'offline',
                            last_seen: new Date().toISOString()
                        },
                        error: null
                    };
                }
                return { presence: null, error: error.message };
            }

            return { presence: data, error: null };
        } catch (err) {
            return { presence: null, error: err instanceof Error ? err.message : 'Failed to get user presence' };
        }
    }

    /**
     * Subscribe to presence changes
     */
    subscribeToPresence(
        onPresenceChange: (presence: UserPresence) => void
    ): () => void {
        const subscription = supabase
            .channel('user-presence-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_presence',
                },
                (payload) => {
                    if (payload.new) {
                        onPresenceChange(payload.new as UserPresence);
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }

    /**
     * Subscribe to specific user's presence
     */
    subscribeToUserPresence(
        userId: string,
        onPresenceChange: (presence: UserPresence) => void
    ): () => void {
        const subscription = supabase
            .channel(`user-presence-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_presence',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    if (payload.new) {
                        onPresenceChange(payload.new as UserPresence);
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }

    /**
     * Check if user is online (within last 5 minutes)
     */
    isUserOnline(presence: UserPresence): boolean {
        if (presence.status === 'offline') return false;

        const lastSeen = new Date(presence.last_seen);
        const now = new Date();
        const diffMinutes = (now.getTime() - lastSeen.getTime()) / 1000 / 60;

        return diffMinutes < 5 && ['online', 'away', 'busy'].includes(presence.status);
    }

    /**
     * Cleanup presence on logout
     */
    async cleanup(userId: string): Promise<void> {
        this.stopHeartbeat();
        await this.updatePresence(userId, 'offline');
    }
}

export const presenceService = new PresenceService();
