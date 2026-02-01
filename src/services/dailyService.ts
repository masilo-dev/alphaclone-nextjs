import { supabase } from '../lib/supabase';
import Daily, { DailyCall } from '@daily-co/daily-js';
import { tenantService } from './tenancy/TenantService';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Daily.co Video Service
 * Handles video room creation, management, and meeting coordination using Daily.co
 */

export interface DailyRoom {
    id: string;
    name: string;
    url: string;
    config: {
        nbf?: number; // Not before (unix timestamp)
        exp?: number; // Expiration (unix timestamp)
        enable_screenshare?: boolean;
        enable_chat?: boolean;
        enable_recording?: string;
        max_participants?: number;
    };
}

export interface VideoCall {
    id: string;
    room_id: string;
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
    scheduled_at: Date;
    created_at: Date;
    updated_at: Date;
}

class DailyService {
    /**
     * Create a new Daily.co room via backend API
     */
    async createRoom(options: {
        title: string;
        maxParticipants?: number;
        enableScreenshare?: boolean;
        enableChat?: boolean;
        enableRecording?: boolean;
        startTime?: Date;
        duration?: number; // minutes
    }): Promise<{ room: DailyRoom | null; error: string | null }> {
        try {
            // Generate a unique room name
            const roomName = `room-${Date.now()}-${Math.random().toString(36).substring(7)}`;

            // Build properties object
            const properties: Record<string, any> = {
                enable_screenshare: options.enableScreenshare !== false,
                enable_chat: options.enableChat !== false,
                max_participants: options.maxParticipants || 10,
            };

            // Only include recording if enabled
            if (options.enableRecording) {
                properties.enable_recording = 'cloud';
            }

            // Only include nbf if startTime is provided
            if (options.startTime) {
                properties.nbf = Math.floor(options.startTime.getTime() / 1000);
            }

            // Only include exp if both duration and startTime are provided
            if (options.duration && options.startTime) {
                properties.exp = Math.floor((options.startTime.getTime() + options.duration * 60000) / 1000);
            } else if (options.duration) {
                // Set exp relative to now if start time not fixed
                properties.exp = Math.floor((Date.now() + options.duration * 60000) / 1000);
            }

            const response = await fetch('/api/daily/create-room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: roomName, properties })
            });

            if (!response.ok) {
                const errorData = await response.json();
                return { room: null, error: errorData.error || 'Failed to create room' };
            }

            const room = await response.json();
            return { room, error: null };
        } catch (err) {
            return { room: null, error: err instanceof Error ? err.message : 'Failed to create room' };
        }
    }

    /**
     * Get a meeting token for a room
     */
    async getMeetingToken(roomName: string, userName: string, isOwner: boolean = false): Promise<{ token: string | null; roomUrl?: string | null; error: string | null }> {
        try {
            const response = await fetch('/api/daily/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName, userName, isOwner })
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
    }): Promise<{ call: VideoCall | null; error: string | null }> {
        try {
            // ENFORCE PLAN LIMITS
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('No tenant context found');

            const { data: tenantData } = await supabase
                .from('tenants')
                .select('subscription_status, subscription_plan, slug')
                .eq('id', tenantId)
                .single();

            const isSuperAdminTenant = tenantData?.slug === 'default';
            const plan = (tenantData?.subscription_plan as any) || 'free';
            const { PLAN_PRICING } = await import('./tenancy/types');
            const planFeatures = { ...PLAN_PRICING[plan as keyof typeof PLAN_PRICING].features }; // Clone features

            // SUPER ADMIN BYPASS: Default tenant has no limits
            if (isSuperAdminTenant) {
                planFeatures.maxVideoMeetingsPerMonth = -1;
                planFeatures.maxVideoMinutesPerMeeting = -1;
            }

            // 1. Check Monthly Meeting Limit
            if (planFeatures.maxVideoMeetingsPerMonth !== -1) {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

                const { count } = await supabase
                    .from('video_calls')
                    .select('*', { count: 'exact', head: true })
                    .eq('host_id', data.hostId)
                    .gte('created_at', startOfMonth);

                if (count !== null && count >= planFeatures.maxVideoMeetingsPerMonth) {
                    return {
                        call: null,
                        error: `Monthly limit reached: Your ${plan} plan allows ${planFeatures.maxVideoMeetingsPerMonth} meetings per month. Please upgrade to host more.`
                    };
                }
            }

            // 2. Determine Duration Limit
            const durationLimit = planFeatures.maxVideoMinutesPerMeeting === -1
                ? (data.duration || 1440)
                : Math.min(data.duration || 1440, planFeatures.maxVideoMinutesPerMeeting);

            // Create Daily room
            const { room, error: roomError } = await this.createRoom({
                title: data.title,
                maxParticipants: data.maxParticipants,
                enableScreenshare: data.screenShareEnabled,
                enableChat: data.chatEnabled,
                enableRecording: data.recordingEnabled,
                duration: durationLimit
            });

            if (roomError || !room) {
                return { call: null, error: roomError || 'Failed to create room' };
            }

            // Insert into database
            const { data: dbData, error: dbError } = await supabase
                .from('video_calls')
                .insert({
                    room_id: room.name,
                    daily_room_url: room.url,
                    daily_room_name: room.name,
                    host_id: data.hostId,
                    calendar_event_id: data.calendarEventId,
                    title: data.title,
                    status: 'scheduled',
                    participants: data.participants || [],
                    max_participants: data.maxParticipants || 10,
                    recording_enabled: data.recordingEnabled || false,
                    screen_share_enabled: data.screenShareEnabled !== false,
                    chat_enabled: data.chatEnabled !== false,
                    cancellation_policy_hours: data.cancellationPolicyHours || 3,
                    allow_client_cancellation: data.allowClientCancellation !== false,
                    is_public: data.isPublic || false,
                })
                .select()
                .single();

            if (dbError) {
                return { call: null, error: dbError.message };
            }

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
            const { error } = await supabase
                .from('video_calls')
                .update({
                    status: 'active',
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', callId);

            return { error: error ? error.message : null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to start video call' };
        }
    }

    /**
     * End a video call
     */
    async endVideoCall(callId: string, durationSeconds?: number): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('video_calls')
                .update({
                    status: 'ended',
                    ended_at: new Date().toISOString(),
                    duration_seconds: durationSeconds,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', callId);

            return { error: error ? error.message : null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to end video call' };
        }
    }

    /**
     * Create a Daily call instance for embedding
     */
    createCallObject(containerElement?: HTMLElement): DailyCall {
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
