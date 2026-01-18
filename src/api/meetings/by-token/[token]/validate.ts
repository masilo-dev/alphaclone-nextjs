import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface MeetingValidationResult {
    valid: boolean;
    reason?: string;
    meeting_id?: string;
    meeting_title?: string;
    host_name?: string;
    expires_at?: string;
}

/**
 * GET /api/meetings/:token/validate
 *
 * Validate meeting link before showing join UI
 * Checks if link is:
 * - Not expired
 * - Not already used
 * - Exists in database
 */
export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Token is required' });
        }

        // Initialize Supabase client
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Call database function to validate link
        const { data, error } = await supabase
            .rpc('is_meeting_link_valid', { p_token: token })
            .single() as { data: MeetingValidationResult | null; error: any };

        if (error) {
            console.error('Error validating meeting link:', error);
            return res.status(500).json({ error: 'Failed to validate meeting link' });
        }

        if (!data) {
            return res.status(404).json({
                valid: false,
                reason: 'not_found'
            });
        }

        // Return validation result
        if (data.valid) {
            return res.status(200).json({
                valid: true,
                meeting: {
                    id: data.meeting_id,
                    title: data.meeting_title,
                    hostName: data.host_name,
                    expiresAt: data.expires_at
                }
            });
        } else {
            // Map reason to friendly codes
            let reasonCode = 'unknown';
            if (data.reason?.includes('expired')) {
                reasonCode = 'expired';
            } else if (data.reason?.includes('used')) {
                reasonCode = 'used';
            } else if (data.reason?.includes('not found')) {
                reasonCode = 'not_found';
            }

            return res.status(200).json({
                valid: false,
                reason: reasonCode,
                message: data.reason
            });
        }

    } catch (error) {
        console.error('Error in validate endpoint:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to validate meeting link'
        });
    }
}
