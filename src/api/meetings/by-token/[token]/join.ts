import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface MarkUsedResult {
    success: boolean;
    error_message?: string;
    meeting_id?: string;
    daily_room_url?: string;
}

/**
 * POST /api/meetings/:token/join
 *
 * Join meeting - validates token, generates Daily token, marks link as used
 * This is the ONLY endpoint that returns Daily.co URL to frontend
 * Returns one-time Daily room URL + short-lived token
 */
export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { token } = req.query;
        const { userId, userName } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Token is required' });
        }

        if (!userId || !userName) {
            return res.status(400).json({ error: 'userId and userName are required' });
        }

        // Initialize Supabase client
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Step 1: Mark meeting link as used (atomically)
        const { data: markUsedResult, error: markUsedError } = await supabase
            .rpc('mark_meeting_link_used', {
                p_token: token,
                p_user_id: userId
            })
            .single() as { data: MarkUsedResult | null; error: any };

        if (markUsedError || !markUsedResult) {
            console.error('Error marking link as used:', markUsedError);
            return res.status(500).json({ error: 'Failed to process meeting link' });
        }

        if (!markUsedResult.success) {
            return res.status(400).json({
                success: false,
                error: markUsedResult.error_message || 'Meeting link is invalid or already used'
            });
        }

        const meetingId = markUsedResult.meeting_id;
        const dailyRoomUrl = markUsedResult.daily_room_url;

        if (!dailyRoomUrl) {
            return res.status(500).json({ error: 'Meeting room URL not found' });
        }

        // Step 2: Get meeting details
        const { data: meeting, error: meetingError } = await supabase
            .from('video_calls')
            .select('duration_limit_minutes, status')
            .eq('id', meetingId)
            .single();

        if (meetingError || !meeting) {
            return res.status(500).json({ error: 'Failed to get meeting details' });
        }

        // Check if meeting is already ended or cancelled
        if (meeting.status === 'ended' || meeting.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                error: `Meeting has been ${meeting.status}`
            });
        }

        // Step 3: Generate Daily.co meeting token (40-minute expiry)
        const durationMinutes = meeting.duration_limit_minutes || 40;
        const expiryTimestamp = Math.floor(Date.now() / 1000) + (durationMinutes * 60);

        // Extract room name from URL
        const roomName = dailyRoomUrl.split('/').pop();

        const dailyTokenResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
            },
            body: JSON.stringify({
                properties: {
                    room_name: roomName,
                    user_name: userName,
                    exp: expiryTimestamp,
                    enable_screenshare: true,
                    start_video_off: false,
                    start_audio_off: false
                }
            })
        });

        if (!dailyTokenResponse.ok) {
            const errorData = await dailyTokenResponse.json();
            console.error('Daily token generation failed:', errorData);
            return res.status(500).json({ error: 'Failed to generate meeting token' });
        }

        const dailyTokenData = await dailyTokenResponse.json();

        // Step 4: Update meeting status to 'active' if this is first join
        if (meeting.status === 'scheduled') {
            const now = new Date().toISOString();
            const autoEndAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

            await supabase
                .from('video_calls')
                .update({
                    status: 'active',
                    started_at: now,
                    auto_end_scheduled_at: autoEndAt,
                    updated_at: now
                })
                .eq('id', meetingId);
        }

        // Step 5: Return Daily URL + token (one-time only)
        const autoEndAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

        return res.status(200).json({
            success: true,
            dailyUrl: dailyRoomUrl,
            dailyToken: dailyTokenData.token,
            meetingId: meetingId,
            autoEndAt: autoEndAt,
            durationMinutes: durationMinutes
        });

    } catch (error) {
        console.error('Error in join endpoint:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to join meeting'
        });
    }
}
