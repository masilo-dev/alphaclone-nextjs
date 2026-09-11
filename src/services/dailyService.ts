import { supabase } from '../lib/supabase';
import type { DailyCall } from '@daily-co/daily-js';
import { tenantService } from './tenancy/TenantService';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { MAX_MEETING_DURATION_MINUTES } from '@/lib/meetingLimits';


/**
 * Daily.co Video Service
 * Handles video room creation, management, and meeting coordination using Daily.co
 */

export interface VideoCall {
    id: string;
    room_id: string;
    tenant_id?: string;
    daily_room_url?: string;
    daily_room_name?: string;
    host_id: string;
    calendar_event_id?: string;
    title: string;
    status: 'scheduled' | 'active' | 'ended' | 'cancelled';
    started_at?: Date;
    ended_at?: Date;
    duration_seconds?: number;
    participants: string[];
    max_participants: number;
    recording_enabled: boolean;
    recording_url?: string;
    screen_share_enabled: boolean;
    chat_enabled: boolean;
    metadata: Record<string, any>;
    cancellation_policy_hours: number;
    allow_client_cancellation: boolean;
    cancelled_by?: string;
    cancelled_at?: Date;
    cancellation_reason?: string;
    description?: string;
    is_public: boolean;
    is_permanent?: boolean;
    scheduled_at: Date;
    created_at: Date;
    updated_at: Date;
}

class DailyService {
    /**
     * Get a masked meeting URL for the application
     */
    getWrappedMeetingUrl(id: string): string {
        // Return exactly alphaclonesystems.com as requested by the user
        return `https://alphaclonesystems.com/meet/${id}`;
    }

    /**
     * Get a meeting token for a room
     */
    async getMeetingToken(callId: string, guestName: string, meetingAccessPin?: string, meetingAccessToken?: string): Promise<{ token: string | null; roomUrl?: string | null; error: string | null }> {
        try {
            const response = await fetch('/api/daily/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callId, guestName, meetingAccessPin, meetingAccessToken })
            });

            if (!response.ok) {
                const errorData = await response.json();
                return { token: null, error: errorData.error || 'Failed to create token' };
            }

            const data = await response.json();
            return { token: data.token, roomUrl: data.roomUrl, error: null };
        } catch (err) {
            return { token: null, roomUrl: null, error: err instanceof Error ? err.message : 'Failed to get token' };
        }
    }

    /**
     * Create a video call in database
     */
    async createVideoCall(data: {
        hostId: string;
        title: string;
        calendarEventId?: string;
        participants?: string[];
        maxParticipants?: number;
        recordingEnabled?: boolean;
        screenShareEnabled?: boolean;
        chatEnabled?: boolean;
        cancellationPolicyHours?: number;
        allowClientCancellation?: boolean;
        duration?: number;
        isPublic?: boolean;
        tenantId?: string;
    }): Promise<{ call: VideoCall | null; error: string | null }> {
        try {
            const tenantId = data.tenantId || tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('No tenant context found');
            const response = await fetch('/api/meetings/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    hostId: data.hostId,
                    title: data.title,
                    participants: data.participants || [],
                    maxParticipants: data.maxParticipants || 10,
                    recordingEnabled: Boolean(data.recordingEnabled),
                    screenShareEnabled: data.screenShareEnabled !== false,
                    chatEnabled: data.chatEnabled !== false,
                    cancellationPolicyHours: data.cancellationPolicyHours ?? 3,
                    allowClientCancellation: data.allowClientCancellation !== false,
                    durationMinutes: data.duration || MAX_MEETING_DURATION_MINUTES,
                    isPublic: Boolean(data.isPublic),
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.call) return { call: null, error: payload.error || 'Failed to create video call' };
            const dbData = payload.call;

            const call: VideoCall = {
                ...dbData,
                created_at: new Date(dbData.created_at),
                updated_at: new Date(dbData.updated_at),
                scheduled_at: new Date(dbData.scheduled_at),
                started_at: dbData.started_at ? new Date(dbData.started_at) : undefined,
                ended_at: dbData.ended_at ? new Date(dbData.ended_at) : undefined,
                cancelled_at: dbData.cancelled_at ? new Date(dbData.cancelled_at) : undefined,
                is_public: dbData.is_public || false,
            };

            return { call, error: null };
        } catch (err) {
            console.error('Error in createVideoCall:', err);
            return { call: null, error: err instanceof Error ? err.message : 'Failed to create video call' };
        }
    }

    /**
     * Get video call by ID
     */
    async getVideoCall(callId: string): Promise<{ call: VideoCall | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('video_calls')
                .select('*')
                .eq('id', callId)
                .single();

            if (error) {
                return { call: null, error: error.message };
            }

            const call: VideoCall = {
                ...data,
                created_at: new Date(data.created_at),
                updated_at: new Date(data.updated_at),
                scheduled_at: new Date(data.scheduled_at),
                started_at: data.started_at ? new Date(data.started_at) : undefined,
                ended_at: data.ended_at ? new Date(data.ended_at) : undefined,
                cancelled_at: data.cancelled_at ? new Date(data.cancelled_at) : undefined,
                is_public: data.is_public || false,
            };

            return { call, error: null };
        } catch (err) {
            return { call: null, error: err instanceof Error ? err.message : 'Failed to get video call' };
        }
    }

    /**
     * Get all video calls for a user
     */
    async getUserVideoCall(userId: string, status?: string): Promise<{ calls: VideoCall[]; error: string | null }> {
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
                return { calls: [], error: error.message };
            }

            const calls: VideoCall[] = (data || []).map((d: any) => ({
                ...d,
                created_at: new Date(d.created_at),
                updated_at: new Date(d.updated_at),
                scheduled_at: new Date(d.scheduled_at),
                started_at: d.started_at ? new Date(d.started_at) : undefined,
                ended_at: d.ended_at ? new Date(d.ended_at) : undefined,
                cancelled_at: d.cancelled_at ? new Date(d.cancelled_at) : undefined,
                is_public: d.is_public || false,
            }));

            return { calls, error: null };
        } catch (err) {
            return { calls: [], error: err instanceof Error ? err.message : 'Failed to get video calls' };
        }
    }

    /**
     * Check if user can cancel a meeting
     */
    async canCancelMeeting(meetingId: string, userId: string): Promise<{ canCancel: boolean; reason?: string; error: string | null }> {
        try {
            const { data, error } = await supabase.rpc('can_cancel_meeting', {
                meeting_id: meetingId,
                user_id: userId
            });

            if (error) {
                return { canCancel: false, error: error.message };
            }

            if (!data) {
                return { canCancel: false, reason: 'Meeting not found or cancellation not allowed', error: null };
            }

            return { canCancel: true, error: null };
        } catch (err) {
            return { canCancel: false, error: err instanceof Error ? err.message : 'Failed to check cancellation policy' };
        }
    }

    /**
     * Cancel a video call
     */
    async cancelVideoCall(
        callId: string,
        userId: string,
        reason?: string
    ): Promise<{ success: boolean; error: string | null }> {
        try {
            // Check if user can cancel
            const { canCancel, error: checkError } = await this.canCancelMeeting(callId, userId);

            if (checkError) {
                return { success: false, error: checkError };
            }

            if (!canCancel) {
                return { success: false, error: 'You cannot cancel this meeting at this time' };
            }

            // Update the call status
            const { error } = await supabase
                .from('video_calls')
                .update({
                    status: 'cancelled',
                    cancelled_by: userId,
                    cancelled_at: new Date().toISOString(),
                    cancellation_reason: reason,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', callId);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to cancel video call' };
        }
    }

    /**
     * Start a video call (mark as active)
     */
    async startVideoCall(callId: string): Promise<{ error: string | null }> {
        try {
            const response = await fetch(`/api/meetings/${encodeURIComponent(callId)}/state`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start' }),
            });
            const payload = await response.json().catch(() => ({}));
            return { error: response.ok ? null : payload.error || 'Failed to start video call' };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to start video call' };
        }
    }

    /**
     * End a video call
     */
    async endVideoCall(callId: string, durationSeconds?: number, rotatePin = false): Promise<{ error: string | null }> {
        try {
            const response = await fetch(`/api/meetings/${encodeURIComponent(callId)}/state`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'end', durationSeconds, rotatePin }),
            });
            const payload = await response.json().catch(() => ({}));
            return { error: response.ok ? null : payload.error || 'Failed to end video call' };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to end video call' };
        }
    }

    /**
     * Create a Daily call instance for embedding.
     * Uses dynamic import so @daily-co/daily-js never runs during SSR/prerender.
     */
    async createCallObject(containerElement?: HTMLElement): Promise<DailyCall> {
        const { default: Daily } = await import('@daily-co/daily-js');
        if (containerElement) {
            return Daily.createFrame(containerElement, {
                showLeaveButton: true,
                iframeStyle: {
                    width: '100%',
                    height: '100%',
                    border: '0',
                    borderRadius: '8px',
                }
            });
        }

        return Daily.createCallObject();
    }

    /**
     * Join a Daily room
     */
    async joinRoom(
        callObject: DailyCall,
        roomUrl: string,
        userName: string,
        token?: string
    ): Promise<{ error: string | null }> {
        try {
            await callObject.join({
                url: roomUrl,
                userName: userName,
                token: token
            });
            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to join room' };
        }
    }

    /**
     * Leave a Daily room
     */
    async leaveRoom(callObject: DailyCall): Promise<{ error: string | null }> {
        try {
            await callObject.leave();
            await callObject.destroy();
            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to leave room' };
        }
    }

    /**
     * Subscribe to video call status changes (for detecting when admin ends call for all)
     */
    subscribeToCallStatus(
        callId: string,
        onStatusChange: (status: string) => void
    ): () => void {
        const subscription = supabase
            .channel(`call-status-${callId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'video_calls',
                    filter: `id=eq.${callId}`,
                },
                (payload: RealtimePostgresChangesPayload<any>) => {
                    if (payload.new && 'status' in payload.new) {
                        onStatusChange(payload.new.status as string);
                    }
                }
            )
            .subscribe();

        // Return unsubscribe function
        return () => {
            subscription.unsubscribe();
        };
    }
}

export const dailyService = new DailyService();
