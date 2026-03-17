import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * POST /api/meetings/create
 * 
 * App Router implementation of meeting creation
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            title,
            hostId,
            maxParticipants = 10,
            durationMinutes = 40,
            calendarEventId,
            participants = []
        } = body;

        // Validation
        if (!title || !hostId) {
            return NextResponse.json({ error: 'Title and hostId are required' }, { status: 400 });
        }

        // Enforce 40-minute maximum
        const actualDuration = Math.min(durationMinutes, 40);

        // Initialize Supabase client
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Server configuration error: Missing Supabase credentials' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Step 1: Create Daily.co room
        const roomName = `room-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const DAILY_API_KEY = process.env.DAILY_API_KEY;

        if (!DAILY_API_KEY) {
            return NextResponse.json({ error: 'Server configuration error: Missing Daily API Key' }, { status: 500 });
        }

        const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
                name: roomName,
                properties: {
                    enable_screenshare: true,
                    enable_chat: true,
                    max_participants: maxParticipants,
                    start_video_off: false,
                    start_audio_off: false,
                    enable_prejoin_ui: true,
                    enable_network_ui: true,
                    enable_advanced_chat: true,
                    // Set expiry for X minutes from now
                    exp: Math.floor(Date.now() / 1000) + (actualDuration * 60)
                }
            })
        });

        if (!dailyResponse.ok) {
            const errorData = await dailyResponse.json();
            return NextResponse.json({
                error: errorData.error || 'Failed to create Daily.co room'
            }, { status: dailyResponse.status });
        }

        const dailyRoom = await dailyResponse.json();

        // Step 2: Create video_call in database
        const { data: videoCall, error: videoCallError } = await supabase
            .from('video_calls')
            .insert({
                room_id: dailyRoom.name,
                daily_room_url: dailyRoom.url,
                daily_room_name: dailyRoom.name,
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
                allow_client_cancellation: true
            })
            .select()
            .single();

        if (videoCallError || !videoCall) {
            return NextResponse.json({ error: videoCallError?.message || 'Failed to create video call' }, { status: 500 });
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
            return NextResponse.json({ error: linkError?.message || 'Failed to create meeting link' }, { status: 500 });
        }

        // Step 5: Return AlphaClone URL (not Daily.co URL)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech';
        const meetingUrl = `${baseUrl}/meet/${linkToken}`;

        return NextResponse.json({
            meetingId: videoCall.id,
            meetingUrl: meetingUrl,
            token: linkToken,
            expiresAt: expiresAt,
            durationMinutes: actualDuration,
            title: title,
            hostId: hostId
        });

    } catch (error) {
        console.error('Error creating meeting:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to create meeting'
        }, { status: 500 });
    }
}
