<<<<<<< HEAD
import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isProduction } from '@/lib/security/productionGuard';
=======
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
>>>>>>> origin/main

const supabaseAdmin = createSupabaseAdminClient();

export async function POST(req: Request) {
<<<<<<< HEAD
    if (isProduction()) {
        const expected = process.env.DAILY_WEBHOOK_SECRET;
        if (!expected) {
            return NextResponse.json({ error: 'Webhook verification not configured' }, { status: 503 });
        }
        const secret = req.headers.get('x-daily-webhook-secret');
        if (!secret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        try {
            const a = Buffer.from(secret);
            const b = Buffer.from(expected);
            if (a.length !== b.length || !timingSafeEqual(a, b)) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

=======
>>>>>>> origin/main
    try {
        const body = await req.json();

        // The exact payload depends on Daily's webhook structure.
        // Usually, the event type is inside `type` and for recordings it's `recording.ready`.
        if (body.type === 'recording.ready-to-download' || body.type === 'recording.ready') {
            const { room_name, download_link, duration, id } = body.payload || body;
            
            if (!room_name || !download_link) {
                return NextResponse.json({ error: 'Missing recording data' }, { status: 400 });
            }

            // The room_name in Daily corresponds to `daily_room_url` ending
            // We need to match it with the `video_calls` table
            
            // In a real scenario, you'd match the exact room name.
            // Let's use `daily_room_url` matching:
            // Since we don't have exactly the room_name field, we'll use a ilike match on daily_room_url
            const { data: calls, error: matchError } = await supabaseAdmin
                .from('video_calls')
                .select('*')
                .ilike('daily_room_url', `%${room_name}%`)
                .order('created_at', { ascending: false })
                .limit(1);

            if (matchError || !calls || calls.length === 0) {
                console.error('Failed to match room_name to video call:', matchError);
                return NextResponse.json({ error: 'Call not found' }, { status: 404 });
            }

            const call = calls[0];
            const currentMetadata = call.metadata || {};

            // We append the recording info
            const recordings = currentMetadata.recordings || [];
            recordings.push({
                id,
                download_link,
                duration,
                created_at: new Date().toISOString()
            });

            const { error: updateError } = await supabaseAdmin
                .from('video_calls')
                .update({
                    metadata: {
                        ...currentMetadata,
                        recordings
                    }
                })
                .eq('id', call.id);

            if (updateError) {
                console.error('Failed to update call metadata:', updateError);
                return NextResponse.json({ error: 'Failed to update call metadata' }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Daily webhook error:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
