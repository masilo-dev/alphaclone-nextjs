import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { start } from 'workflow/api';
import { videoRoomOrchestrationWorkflow } from '@/workflows/video-room-orchestration';
import {
    createAdminSupabaseClientOrThrow,
    requireAuthenticatedUser,
    routeErrorResponse,
} from '@/lib/apiAuth';

/**
 * POST /api/meetings/create
 * 
 * App Router implementation of meeting creation
 */
export async function POST(req: NextRequest) {
    try {
        const { user } = await requireAuthenticatedUser();
        const body = await req.json();
        const {
            title,
            hostId: requestedHostId,
            maxParticipants = 10,
            durationMinutes = 40,
            calendarEventId,
            participants = []
        } = body;

        const hostId = requestedHostId || user.id;

        // Validation
        if (!title || !hostId) {
            return NextResponse.json({ error: 'Title and hostId are required' }, { status: 400 });
        }

        if (hostId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Enforce 40-minute maximum
        const actualDuration = Math.min(durationMinutes, 40);

        const supabase = createAdminSupabaseClientOrThrow();

        const { data: tenantUser } = await supabase
            .from('tenant_users')
            .select('tenant_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
        const tenantId = tenantUser?.tenant_id || null;
        const roomName = `alphaclone-${crypto.randomUUID()}`;

        // Step 2: Create video_call in database
        const { data: videoCall, error: videoCallError } = await supabase
            .from('video_calls')
            .insert({
                room_id: roomName,
                daily_room_url: null,
                daily_room_name: null,
                tenant_id: tenantId,
                host_id: hostId,
                calendar_event_id: calendarEventId,
                title: title,
                status: 'scheduled',
                participants: participants,
                max_participants: maxParticipants,
                recording_enabled: false,
                screen_share_enabled: true,
                chat_enabled: true,
                duration_limit_minutes: actualDuration,
                cancellation_policy_hours: 3,
                allow_client_cancellation: true,
                metadata: {
                    provider: 'livekit',
                    provider_room_name: roomName,
                },
            })
            .select()
            .single();

        if (videoCallError || !videoCall) {
            console.error('[meetings/create] video_calls insert:', videoCallError);
            return NextResponse.json({ error: 'Failed to create video call', code: 'VIDEO_CALL_DB_ERROR' }, { status: 500 });
        }

        // Step 3: Generate secure token for meeting link
        const linkToken = crypto.randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + actualDuration * 60 * 1000).toISOString();

        // Step 4: Create meeting link
        const { data: meetingLink, error: linkError } = await supabase
            .from('meeting_links')
            .insert({
                meeting_id: videoCall.id,
                link_token: linkToken,
                expires_at: expiresAt,
                max_uses: 1, // Single-use link
                use_count: 0,
                used: false,
                created_by: hostId
            })
            .select()
            .single();

        if (linkError || !meetingLink) {
            console.error('[meetings/create] meeting_links insert:', linkError);
            return NextResponse.json({ error: 'Failed to create meeting link', code: 'MEETING_LINK_DB_ERROR' }, { status: 500 });
        }

        // Step 5: Return AlphaClone URL (not Daily.co URL)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
        const meetingUrl = `${baseUrl}/meet/${linkToken}`;

        const { runId } = await start(videoRoomOrchestrationWorkflow, [{ meetingId: videoCall.id, tenantId }]);

        return NextResponse.json({
            meetingId: videoCall.id,
            meetingUrl: meetingUrl,
            token: linkToken,
            expiresAt: expiresAt,
            durationMinutes: actualDuration,
            title: title,
            hostId: hostId,
            runId
        });

    } catch (error) {
        return routeErrorResponse(error, 'Failed to create meeting.', req);
    }
}
