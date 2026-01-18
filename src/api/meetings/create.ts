import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * POST /api/meetings/create
 *
 * Create a new meeting with single-use link and 40-minute time limit
 * Returns AlphaClone URL (/meet/:token), NOT Daily.co URL
 */
export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            title,
            hostId,
            maxParticipants = 10,
            durationMinutes = 40,
            calendarEventId,
            participants = []
        } = req.body;

        // Validation
        if (!title || !hostId) {
            return res.status(400).json({ error: 'Title and hostId are required' });
        }

        // Enforce 40-minute maximum
        const actualDuration = Math.min(durationMinutes, 40);

        // Initialize Supabase client
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Step 1: Create Daily.co room
        const roomName = `room-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

        const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
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
                    // Set expiry for 40 minutes from now
                    exp: Math.floor(Date.now() / 1000) + (actualDuration * 60)
                }
            })
        });

        if (!dailyResponse.ok) {
            const errorData = await dailyResponse.json();
            return res.status(dailyResponse.status).json({
                error: errorData.error || 'Failed to create Daily.co room'
            });
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
            return res.status(500).json({ error: videoCallError?.message || 'Failed to create video call' });
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
            return res.status(500).json({ error: linkError?.message || 'Failed to create meeting link' });
        }

        // Step 5: Return AlphaClone URL (not Daily.co URL)
        const baseUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
        const meetingUrl = `${baseUrl}/meet/${linkToken}`;

        return res.status(200).json({
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
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to create meeting'
        });
    }
}
