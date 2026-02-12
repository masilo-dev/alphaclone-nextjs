import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/meetings/by-id/[meetingId]/end
 * 
 * App Router implementation of ending a meeting
 * - Updates status to 'ended'
 * - Invalidates all meeting links
 * - Cleans up Daily.co room
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { meetingId: string } }
) {
    try {
        const { meetingId } = params;
        const body = await req.json();
        const { userId, reason = 'manual', durationSeconds } = body;

        if (!meetingId) {
            return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
        }

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        if (!['manual', 'time_limit', 'all_left'].includes(reason)) {
            return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
        }

        // Initialize Supabase client
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Step 1: Get meeting details and verify permissions
        const { data: meeting, error: meetingError } = await supabase
            .from('video_calls')
            .select('host_id, status, daily_room_name')
            .eq('id', meetingId)
            .single();

        if (meetingError || !meeting) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
        }

        // Check if meeting is already ended
        if (meeting.status === 'ended') {
            return NextResponse.json({
                success: true,
                message: 'Meeting already ended'
            });
        }

        // Step 2: Verify user permissions (host or admin)
        const { data: userProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        const isHost = meeting.host_id === userId;
        const isAdmin = userProfile?.role === 'admin';

        if (!isHost && !isAdmin && reason !== 'time_limit') {
            return NextResponse.json({ error: 'You do not have permission to end this meeting' }, { status: 403 });
        }

        // Step 3: Update meeting status to ended
        const now = new Date().toISOString();

        const { error: updateError } = await supabase
            .from('video_calls')
            .update({
                status: 'ended',
                ended_at: now,
                ended_reason: reason,
                duration_seconds: durationSeconds,
                updated_at: now
            })
            .eq('id', meetingId);

        if (updateError) {
            console.error('Error updating meeting:', updateError);
            return NextResponse.json({ error: 'Failed to end meeting' }, { status: 500 });
        }

        // Step 4: Expire all meeting links for this meeting
        const { error: expireLinkError } = await supabase
            .from('meeting_links')
            .update({
                expires_at: now,
                used: true
            })
            .eq('meeting_id', meetingId)
            .eq('used', false);

        if (expireLinkError) {
            console.error('Error expiring meeting links:', expireLinkError);
        }

        // Step 5: Optionally delete Daily.co room
        if (meeting.daily_room_name) {
            const DAILY_API_KEY = process.env.DAILY_API_KEY;
            if (DAILY_API_KEY) {
                try {
                    await fetch(
                        `https://api.daily.co/v1/rooms/${meeting.daily_room_name}`,
                        {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${DAILY_API_KEY}`
                            }
                        }
                    );
                } catch (deleteError) {
                    console.error('Error deleting Daily.co room:', deleteError);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Meeting ended successfully',
            endedAt: now,
            reason: reason
        });

    } catch (error) {
        console.error('Error ending meeting:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to end meeting'
        }, { status: 500 });
    }
}
