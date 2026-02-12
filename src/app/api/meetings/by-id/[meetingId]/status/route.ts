import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface TimeLimitResult {
    exceeded: boolean;
    time_remaining_seconds?: number;
    auto_end_at?: string;
}

/**
 * GET /api/meetings/by-id/[meetingId]/status
 * 
 * App Router implementation of meeting status check
 * Used by frontend to monitor 40-minute timer
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { meetingId: string } }
) {
    try {
        const { meetingId } = params;

        if (!meetingId) {
            return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
        }

        // Initialize Supabase client
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Call database function to check time limit
        const { data, error } = await supabase
            .rpc('check_meeting_time_limit', { p_meeting_id: meetingId })
            .single() as { data: TimeLimitResult | null; error: any };

        if (error) {
            console.error('Error checking meeting time limit:', error);
            return NextResponse.json({ error: 'Failed to check meeting status' }, { status: 500 });
        }

        // Get meeting status
        const { data: meeting, error: meetingError } = await supabase
            .from('video_calls')
            .select('status, ended_reason, started_at, ended_at, title')
            .eq('id', meetingId)
            .single();

        if (meetingError || !meeting) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
        }

        return NextResponse.json({
            meetingId: meetingId,
            title: meeting.title,
            status: meeting.status,
            timeExceeded: data?.exceeded || false,
            timeRemaining: data?.time_remaining_seconds,
            autoEndAt: data?.auto_end_at,
            endReason: meeting.ended_reason,
            startedAt: meeting.started_at,
            endedAt: meeting.ended_at
        });

    } catch (error) {
        console.error('Error in status route:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to get meeting status'
        }, { status: 500 });
    }
}
