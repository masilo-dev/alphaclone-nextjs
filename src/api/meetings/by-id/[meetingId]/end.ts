import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/meetings/:meetingId/end
 *
 * End meeting (admin/host only, or auto-end on timer)
 * Updates status to 'ended' and invalidates all meeting links
 */
export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { meetingId } = req.query;
        const { userId, reason = 'manual', durationSeconds } = req.body;

        if (!meetingId || typeof meetingId !== 'string') {
            return res.status(400).json({ error: 'Meeting ID is required' });
        }

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        if (!['manual', 'time_limit', 'all_left'].includes(reason)) {
            return res.status(400).json({ error: 'Invalid reason' });
        }

        // Initialize Supabase client
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Step 1: Get meeting details and verify permissions
        const { data: meeting, error: meetingError } = await supabase
            .from('video_calls')
            .select('host_id, status, daily_room_name')
            .eq('id', meetingId)
            .single();

        if (meetingError || !meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        // Check if meeting is already ended
        if (meeting.status === 'ended') {
            return res.status(200).json({
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
            return res.status(403).json({ error: 'You do not have permission to end this meeting' });
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
            return res.status(500).json({ error: 'Failed to end meeting' });
        }

        // Step 4: Expire all meeting links for this meeting
        const { error: expireLinkError } = await supabase
            .from('meeting_links')
            .update({
                expires_at: now, // Set expiry to now
                used: true
            })
            .eq('meeting_id', meetingId)
            .eq('used', false);

        if (expireLinkError) {
            console.error('Error expiring meeting links:', expireLinkError);
            // Non-fatal, continue
        }

        // Step 5: Optionally delete Daily.co room (to prevent further joins)
        if (meeting.daily_room_name) {
            try {
                const deleteRoomResponse = await fetch(
                    `https://api.daily.co/v1/rooms/${meeting.daily_room_name}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
                        }
                    }
                );

                if (!deleteRoomResponse.ok) {
                    console.error('Failed to delete Daily.co room:', await deleteRoomResponse.text());
                    // Non-fatal, continue
                }
            } catch (deleteError) {
                console.error('Error deleting Daily.co room:', deleteError);
                // Non-fatal, continue
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Meeting ended successfully',
            endedAt: now,
            reason: reason
        });

    } catch (error) {
        console.error('Error ending meeting:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to end meeting'
        });
    }
}
