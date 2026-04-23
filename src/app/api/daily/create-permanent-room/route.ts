import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

const DAILY_API_URL = 'https://api.daily.co/v1';

const normalizeOrigin = (value: string | null | undefined): string | null => {
    if (!value) return null;
    return value.replace(/\/+$/, '');
};

const resolveAppOrigin = (req: Request): string => {
    const fromOrigin = normalizeOrigin(req.headers.get('origin'));
    if (fromOrigin) return fromOrigin;
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    if (host) return `${proto}://${host}`;
    return normalizeOrigin(ENV.NEXT_PUBLIC_APP_URL) || 'https://alphaclonesystems.com';
};

export async function POST(req: Request) {
    const DAILY_API_KEY = ENV.DAILY_API_KEY;

    if (!DAILY_API_KEY) {
        return NextResponse.json({ error: 'Daily API key not configured' }, { status: 500 });
    }

    try {
        const { userId, userName, tenantId } = await req.json();
        const appOrigin = resolveAppOrigin(req);

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Check if this tenant already has a permanent room
        const { data: existingRoom } = await supabase
            .from('video_calls')
            .select('*')
            .eq('host_id', userId) // Unique per user
            .eq('is_permanent', true)
            .eq('status', 'active')
            .single();

        // 1.5 Resolve tenant slug (body tenantId is authoritative for multi-tenant admins)
        let slug: string | null = null;
        if (tenantId) {
            const { data: byId } = await supabase
                .from('tenants')
                .select('slug')
                .eq('id', tenantId)
                .is('deletion_pending_at', null)
                .maybeSingle();
            slug = byId?.slug ?? null;
        }
        if (!slug) {
            const { data: byAdmin } = await supabase
                .from('tenants')
                .select('slug, id')
                .eq('admin_user_id', userId)
                .is('deletion_pending_at', null)
                .maybeSingle();
            slug = byAdmin?.slug ?? null;
        }

        let resolvedTenantId = tenantId as string | undefined;
        if (!resolvedTenantId) {
            const { data: tenantForHost } = await supabase
                .from('tenants')
                .select('id')
                .eq('admin_user_id', userId)
                .is('deletion_pending_at', null)
                .maybeSingle();
            resolvedTenantId = tenantForHost?.id;
        }

        if (existingRoom) {
            if (existingRoom.daily_room_name) {
                await fetch(`${DAILY_API_URL}/rooms/${existingRoom.daily_room_name}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${DAILY_API_KEY}`,
                    },
                    body: JSON.stringify({
                        properties: {
                            meeting_join_hook: `${appOrigin}/api/meetings/hooks/join`,
                        },
                    }),
                }).catch(() => undefined);
            }
            return NextResponse.json({
                id: existingRoom.id,
                name: existingRoom.daily_room_name,
                url: existingRoom.daily_room_url,
                title: existingRoom.title,
                slug: slug // Return the slug if available
            });
        }

        // 2. Create new Daily room
        // Use a deterministic name based on user identity to ensure individual uniqueness
        const cleanId = userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
        const roomName = `perm-${cleanId}`;

        const response = await fetch(`${DAILY_API_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
                name: roomName,
                properties: {
                    enable_chat: true,
                    enable_screenshare: true,
                    max_participants: 10,
                    privacy: 'public',
                    meeting_join_hook: `${appOrigin}/api/meetings/hooks/join`,
                    // Permanent rooms shouldn't expire soon - 10 years
                    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60)
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            return NextResponse.json({ error: error.info || 'Failed to create Daily room' }, { status: response.status });
        }

        const dailyRoom = await response.json();

        // 3. Save to database
        const { data: newDbRoom, error: dbError } = await supabase
            .from('video_calls')
            .insert({
                room_id: dailyRoom.name,
                daily_room_url: dailyRoom.url,
                daily_room_name: dailyRoom.name,
                host_id: userId,
                tenant_id: resolvedTenantId || null,
                title: `${userName}'s Permanent Office`,
                status: 'active',
                is_permanent: true,
                is_public: true,
                max_participants: 10,
                chat_enabled: true,
                screen_share_enabled: true,
                duration_limit_minutes: 1440 // 24 hours for permanent rooms
            })
            .select()
            .single();

        if (dbError) {
            console.error('[daily/create-permanent-room] dbError:', dbError);
            return NextResponse.json(
                { error: 'Failed to save room to database', code: 'VIDEO_ROOM_DB_ERROR' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            id: newDbRoom.id,
            name: newDbRoom.daily_room_name,
            url: newDbRoom.daily_room_url,
            title: newDbRoom.title,
            slug: slug // Return the slug if available
        });

    } catch (error) {
        console.error('Error creating permanent room:', error);
        return clientErrorResponse(error, { request: req, scope: 'daily/create-permanent-room.POST' });
    }
}
