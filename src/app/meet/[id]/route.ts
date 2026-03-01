import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        if (!id) {
            return NextResponse.redirect(new URL('/404', request.url));
        }

        const supabase = createSupabaseAdminClient();

        // 1. Try to fetch by meeting ID (UUID)
        let { data: call } = await supabase
            .from('video_calls')
            .select('daily_room_url, status, is_permanent')
            .eq('id', id)
            .single();

        // 2. If not found, it might be a tenant slug for a permanent room
        if (!call) {
            // First find the tenant by slug
            const { data: tenant } = await supabase
                .from('tenants')
                .select('id')
                .eq('slug', id)
                .single();

            if (tenant) {
                // Find the permanent room for this tenant
                const { data: permCall } = await supabase
                    .from('video_calls')
                    .select('daily_room_url, status, is_permanent')
                    .eq('tenant_id', tenant.id)
                    .eq('is_permanent', true)
                    .single();

                call = permCall;
            }
        }

        if (!call || !call.daily_room_url) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        if (call.status === 'cancelled' || call.status === 'ended') {
            return NextResponse.redirect(new URL('/dashboard?error=meeting_ended', request.url));
        }

        // Redirect to the actual Daily room URL
        return NextResponse.redirect(call.daily_room_url);
    } catch (err) {
        console.error('[Meet Redirect] Unexpected error:', err);
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }
}
