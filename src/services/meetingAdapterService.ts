import { supabase } from '../lib/supabase';

/**
 * Meeting Adapter Service
 *
 * Provides abstraction layer over Daily.co video infrastructure
 * - Hides Daily.co URLs from frontend
 * - Uses AlphaClone branded /meet/:token URLs
 * - Enforces 40-minute time limits
 * - Implements single-use link validation
 */

export interface AlphaCloneMeeting {
    meetingId: string;
    meetingUrl: string; // /meet/:token (AlphaClone URL)
    token: string;
    expiresAt: string;
    durationMinutes: number;
    title: string;
    hostId: string;
}

export interface MeetingValidation {
    valid: boolean;
    reason?: 'expired' | 'used' | 'not_found' | 'unknown';
    message?: string;
    meeting?: {
        id: string;
        title: string;
        hostName: string;
        expiresAt: string;
    };
}

export interface MeetingJoinResult {
    success: boolean;
    dailyUrl?: string; // Only returned once upon join
    dailyToken?: string; // Short-lived Daily token
    meetingId?: string;
    autoEndAt?: string; // ISO timestamp (40 min from now)
    durationMinutes?: number;
    error?: string;
}

export interface MeetingStatus {
    meetingId: string;
    title: string;
    status: 'scheduled' | 'active' | 'ended' | 'cancelled';
    timeExceeded: boolean;
    timeRemaining?: number; // seconds
    autoEndAt?: string;
    endReason?: string;
    startedAt?: string;
    endedAt?: string;
}

class MeetingAdapterService {
    /**
     * Create a new meeting with single-use link
     * Returns AlphaClone URL (/meet/:token), NOT Daily.co URL
     */
    async createMeeting(options: {
        title: string;
        hostId: string;
        maxParticipants?: number;
        durationMinutes?: number;
        calendarEventId?: string;
        participants?: string[];
    }): Promise<{ meeting: AlphaCloneMeeting | null; error: string | null }> {
        try {
            const response = await fetch('/api/meetings/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(options)
            });

            if (!response.ok) {
                const errorData = await response.json();
                return { meeting: null, error: errorData.error || 'Failed to create meeting' };
            }

            const data = await response.json();

            const meeting: AlphaCloneMeeting = {
                meetingId: data.meetingId,
                meetingUrl: data.meetingUrl,
                token: data.token,
                expiresAt: data.expiresAt,
                durationMinutes: data.durationMinutes,
                title: data.title,
                hostId: data.hostId
            };

            return { meeting, error: null };
        } catch (err) {
            return {
                meeting: null,
                error: err instanceof Error ? err.message : 'Failed to create meeting'
            };
        }
    }

    /**
     * Validate meeting link before showing join UI
     */
    async validateMeetingLink(token: string): Promise<{ validation: MeetingValidation | null; error: string | null }> {
        try {
            const response = await fetch(`/api/meetings/by-token/${token}/validate`);

            if (!response.ok) {
                const errorData = await response.json();
                return { validation: null, error: errorData.error || 'Failed to validate meeting link' };
            }

            const data = await response.json();

            const validation: MeetingValidation = {
                valid: data.valid,
                reason: data.reason,
                message: data.message,
                meeting: data.meeting
            };

            return { validation, error: null };
        } catch (err) {
            return {
                validation: null,
                error: err instanceof Error ? err.message : 'Failed to validate meeting link'
            };
        }
    }

    /**
     * Join meeting - validates token, gets Daily URL + token (one-time only)
     * Marks link as used after successful join
     */
    async joinMeeting(
        token: string,
        userId: string,
        userName: string
    ): Promise<{ result: MeetingJoinResult | null; error: string | null }> {
        try {
            const response = await fetch(`/api/meetings/by-token/${token}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId, userName })
            });

            if (!response.ok) {
                const errorData = await response.json();
                return {
                    result: {
                        success: false,
                        error: errorData.error || 'Failed to join meeting'
                    },
                    error: errorData.error
                };
            }

            const data = await response.json();

            const result: MeetingJoinResult = {
                success: data.success,
                dailyUrl: data.dailyUrl,
                dailyToken: data.dailyToken,
                meetingId: data.meetingId,
                autoEndAt: data.autoEndAt,
                durationMinutes: data.durationMinutes
            };

            return { result, error: null };
        } catch (err) {
            return {
                result: {
                    success: false,
                    error: err instanceof Error ? err.message : 'Failed to join meeting'
                },
                error: err instanceof Error ? err.message : 'Failed to join meeting'
            };
        }
    }

    /**
     * End meeting (admin/host only, or auto-end on timer)
     */
    async endMeeting(
        meetingId: string,
        userId: string,
        reason: 'manual' | 'time_limit' | 'all_left' = 'manual',
        durationSeconds?: number
    ): Promise<{ success: boolean; error: string | null }> {
        try {
            const response = await fetch(`/api/meetings/by-id/${meetingId}/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId, reason, durationSeconds })
            });

            if (!response.ok) {
                const errorData = await response.json();
                return { success: false, error: errorData.error || 'Failed to end meeting' };
            }

            const data = await response.json();
            return { success: data.success, error: null };
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to end meeting'
            };
        }
    }

    /**
     * Get meeting status and time remaining
     * Used by frontend to monitor 40-minute timer
     */
    async getMeetingStatus(meetingId: string): Promise<{ status: MeetingStatus | null; error: string | null }> {
        try {
            const response = await fetch(`/api/meetings/by-id/${meetingId}/status`);

            if (!response.ok) {
                const errorData = await response.json();
                return { status: null, error: errorData.error || 'Failed to get meeting status' };
            }

            const data = await response.json();

            const status: MeetingStatus = {
                meetingId: data.meetingId,
                title: data.title,
                status: data.status,
                timeExceeded: data.timeExceeded,
                timeRemaining: data.timeRemaining,
                autoEndAt: data.autoEndAt,
                endReason: data.endReason,
                startedAt: data.startedAt,
                endedAt: data.endedAt
            };

            return { status, error: null };
        } catch (err) {
            return {
                status: null,
                error: err instanceof Error ? err.message : 'Failed to get meeting status'
            };
        }
    }

    /**
     * Subscribe to meeting status changes via Supabase realtime
     * Useful for detecting when admin ends meeting for all
     */
    subscribeMeetingStatus(
        meetingId: string,
        onStatusChange: (status: 'active' | 'ended' | 'cancelled', reason?: string) => void
    ): () => void {
        const channel = supabase
            .channel(`meeting-status-${meetingId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'video_calls',
                    filter: `id=eq.${meetingId}`,
                },
                (payload) => {
                    if (payload.new && 'status' in payload.new) {
                        const newStatus = payload.new.status as 'active' | 'ended' | 'cancelled';
                        const reason = payload.new.ended_reason as string | undefined;
                        onStatusChange(newStatus, reason);
                    }
                }
            )
            .subscribe();

        // Return unsubscribe function
        return () => {
            supabase.removeChannel(channel);
        };
    }

    /**
     * Get user's meetings (hosted or participating)
     */
    async getUserMeetings(
        userId: string,
        status?: 'scheduled' | 'active' | 'ended'
    ): Promise<{ meetings: any[]; error: string | null }> {
        try {
            let query = supabase
                .from('video_calls')
                .select('*')
                .or(`host_id.eq.${userId},participants.cs.{${userId}}`);

            if (status) {
                query = query.eq('status', status);
            }

            query = query.order('created_at', { ascending: false });

            const { data, error } = await query;

            if (error) {
                return { meetings: [], error: error.message };
            }

            return { meetings: data || [], error: null };
        } catch (err) {
            return {
                meetings: [],
                error: err instanceof Error ? err.message : 'Failed to get user meetings'
            };
        }
    }

    /**
     * Get meeting links for a specific meeting (admin only)
     */
    async getMeetingLinks(meetingId: string): Promise<{ links: any[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('meeting_links')
                .select('*')
                .eq('meeting_id', meetingId)
                .order('created_at', { ascending: false });

            if (error) {
                return { links: [], error: error.message };
            }

            return { links: data || [], error: null };
        } catch (err) {
            return {
                links: [],
                error: err instanceof Error ? err.message : 'Failed to get meeting links'
            };
        }
    }

    /**
     * Generate full AlphaClone meeting URL
     */
    generateMeetingUrl(token: string): string {
        const baseUrl = window.location.origin;
        return `${baseUrl}/meet/${token}`;
    }
}

export const meetingAdapterService = new MeetingAdapterService();
