import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface MarkUsedResult {
    success: boolean;
    error_message?: string;
    meeting_id?: string;
    daily_room_url?: string;
}

/**
 * POST /api/meetings/by-token/[token]/join
 * 
 * App Router implementation of joining a meeting
 * - Validates token
 * - Generates Daily token
 * - Marks link as used (atomically)
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { token: string } }
) {
    try {
        const { token } = params;
        const body = await req.json();
        const { userId, userName } = body;

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        if (!userId || !userName) {
            return NextResponse.json({ error: 'userId and userName are required' }, { status: 400 });
        }

        // Initialize Supabase client
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Step 1: Mark meeting link as used (atomically)
        const { data: markUsedResult, error: markUsedError } = await supabase
            .rpc('mark_meeting_link_used', {
                p_token: token,
                p_user_id: userId
            })
            .single() as { data: MarkUsedResult | null; error: any };

        if (markUsedError || !markUsedResult) {
            console.error('Error marking link as used:', markUsedError);
            return NextResponse.json({ error: 'Failed to process meeting link' }, { status: 500 });
        }

        if (!markUsedResult.success) {
            return NextResponse.json({
                success: false,
                error: markUsedResult.error_message || 'Meeting link is invalid or already used'
            }, { status: 400 });
        }

        const meetingId = markUsedResult.meeting_id;
        const dailyRoomUrl = markUsedResult.daily_room_url;

        if (!dailyRoomUrl) {
            return NextResponse.json({ error: 'Meeting room URL not found' }, { status: 500 });
        }

        // Step 2: Get meeting details
        const { data: meeting, error: meetingError } = await supabase
            .from('video_calls')
            .select('duration_limit_minutes, status')
            .eq('id', meetingId)
            .single();

        if (meetingError || !meeting) {
            return NextResponse.json({ error: 'Failed to get meeting details' }, { status: 500 });
        }

        // Check if meeting is already ended or cancelled
        if (meeting.status === 'ended' || meeting.status === 'cancelled') {
            return NextResponse.json({
                success: false,
                error: `Meeting has been ${meeting.status}`
            }, { status: 400 });
        }

        // Step 3: Generate Daily.co meeting token
        const durationMinutes = meeting.duration_limit_minutes || 40;
        const expiryTimestamp = Math.floor(Date.now() / 1000) + (durationMinutes * 60);

        // Extract room name from URL
        const roomName = dailyRoomUrl.split('/').pop();
        const DAILY_API_KEY = process.env.DAILY_API_KEY;

        if (!DAILY_API_KEY) {
            return NextResponse.json({ error: 'Server configuration error: Missing Daily API Key' }, { status: 500 });
        }

        const dailyTokenResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
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
            return NextResponse.json({ error: 'Failed to generate meeting token' }, { status: 500 });
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

        return NextResponse.json({
            success: true,
            dailyUrl: dailyRoomUrl,
            dailyToken: dailyTokenData.token,
            meetingId: meetingId,
            autoEndAt: autoEndAt,
            durationMinutes: durationMinutes
        });

    } catch (error) {
        console.error('Error in join route:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to join meeting'
        }, { status: 500 });
    }
}
