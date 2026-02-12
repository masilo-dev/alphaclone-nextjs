import { NextRequest, NextResponse } from 'next/server';
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
 * GET /api/meetings/by-token/[token]/validate
 * 
 * App Router implementation of meeting link validation
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { token: string } }
) {
    try {
        const { token } = params;

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        // Initialize Supabase client
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Call database function to validate link
        const { data, error } = await supabase
            .rpc('is_meeting_link_valid', { p_token: token })
            .single() as { data: MeetingValidationResult | null; error: any };

        if (error) {
            console.error('Error validating meeting link:', error);
            return NextResponse.json({ error: 'Failed to validate meeting link' }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({
                valid: false,
                reason: 'not_found'
            }, { status: 404 });
        }

        // Return validation result
        if (data.valid) {
            return NextResponse.json({
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

            return NextResponse.json({
                valid: false,
                reason: reasonCode,
                message: data.reason
            });
        }

    } catch (error) {
        console.error('Error in validation route:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to validate meeting link'
        }, { status: 500 });
    }
}
