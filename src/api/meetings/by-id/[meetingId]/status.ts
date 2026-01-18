import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface TimeLimitResult {
    exceeded: boolean;
    time_remaining_seconds?: number;
    auto_end_at?: string;
}

/**
 * GET /api/meetings/:meetingId/status
 *
 * Check meeting status and time remaining
 * Used by frontend to monitor 40-minute timer
 */
export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { meetingId } = req.query;

        if (!meetingId || typeof meetingId !== 'string') {
            return res.status(400).json({ error: 'Meeting ID is required' });
        }

        // Initialize Supabase client
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Call database function to check time limit
        const { data, error } = await supabase
            .rpc('check_meeting_time_limit', { p_meeting_id: meetingId })
            .single() as { data: TimeLimitResult | null; error: any };

        if (error) {
            console.error('Error checking meeting time limit:', error);
            return res.status(500).json({ error: 'Failed to check meeting status' });
        }

        // Get meeting status
        const { data: meeting, error: meetingError } = await supabase
            .from('video_calls')
            .select('status, ended_reason, started_at, ended_at, title')
            .eq('id', meetingId)
            .single();

        if (meetingError || !meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        return res.status(200).json({
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
        console.error('Error in status endpoint:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get meeting status'
        });
    }
}
