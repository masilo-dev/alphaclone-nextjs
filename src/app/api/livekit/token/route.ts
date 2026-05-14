import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AccessToken } from 'livekit-server-sdk';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { readLiveKitEnv } from '@/services/video/liveKitBridge';

const LIVEKIT = readLiveKitEnv();

function isUuid(value: string): boolean {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

async function getAuthUser() {
    const supabaseUrl = ENV.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = ENV.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anon) return null;

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, anon, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                } catch {
                    /* ignore when called outside a route that can set cookies */
                }
            },
        },
    });

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

    return {
        supabase,
        id: user.id,
        name: (user.user_metadata?.name as string | undefined) || user.email?.split('@')[0] || 'User',
        tenantId: tenantUser?.tenant_id as string | undefined,
    };
}

/**
 * Dashboard / signed-in access: host or same-tenant only.
 * Never grant a token on `is_public` alone (that would let tenant B join tenant A's lobby by UUID).
 */
async function assertCallAccessStrict(
    supabase: SupabaseClient,
    callId: string,
    userId: string,
    tenantId: string | undefined
): Promise<boolean> {
    const { data: call, error } = await supabase
        .from('video_calls')
        .select('id, host_id, tenant_id, status')
        .eq('id', callId)
        .single();

    if (error || !call) return false;
    if (call.status === 'ended' || call.status === 'cancelled') return false;
    if (call.host_id === userId) return true;
    if (call.tenant_id && tenantId && call.tenant_id === tenantId) return true;
    return false;
}

/** Public meeting link + optional PIN (same rules as guest join). Uses service role. */
async function verifyPublicMeetingAccess(callId: string, meetingAccessPin: string | undefined): Promise<boolean> {
    try {
        const admin = createSupabaseAdminClient();
        const { data: call, error } = await admin
            .from('video_calls')
            .select('id, is_public, status, metadata')
            .eq('id', callId)
            .single();

        if (error || !call) return false;
        if (call.status === 'ended' || call.status === 'cancelled') return false;
        if (!call.is_public) return false;

        const expectedPin =
            call.metadata && typeof call.metadata === 'object'
                ? (call.metadata as { meeting_pin?: string }).meeting_pin
                : undefined;
        if (expectedPin && String(expectedPin) !== String(meetingAccessPin || '')) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

export async function POST(req: Request) {
    if (!LIVEKIT.url || !LIVEKIT.apiKey || !LIVEKIT.apiSecret) {
        return NextResponse.json({ error: 'LiveKit is not configured on the server' }, { status: 503 });
    }

    let body: { callId?: string; meetingAccessPin?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const callId = typeof body.callId === 'string' ? body.callId.trim() : '';
    if (!callId || !isUuid(callId)) {
        return NextResponse.json({ error: 'Valid callId is required' }, { status: 400 });
    }

    const pin = typeof body.meetingAccessPin === 'string' ? body.meetingAccessPin.trim() : undefined;

    const authUser = await getAuthUser();

    if (authUser) {
        const strictOk = await assertCallAccessStrict(authUser.supabase, callId, authUser.id, authUser.tenantId);
        if (!strictOk) {
            const publicOk = await verifyPublicMeetingAccess(callId, pin);
            if (!publicOk) {
                return NextResponse.json({ error: 'Not allowed to join this meeting room' }, { status: 403 });
            }
        }
    } else {
        const publicOk = await verifyPublicMeetingAccess(callId, pin);
        if (!publicOk) {
            return NextResponse.json({ error: 'Meeting not found or access denied' }, { status: 403 });
        }
    }

    const roomName = `alphaclone-${callId}`;
    const identity = authUser ? authUser.id : `guest-${callId}-${Math.random().toString(36).slice(2, 10)}`;
    const displayName = authUser ? authUser.name : 'Guest';

    const token = new AccessToken(LIVEKIT.apiKey, LIVEKIT.apiSecret, {
        identity,
        name: displayName,
        ttl: '1h',
    });
    token.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
    });

    try {
        const jwt = await token.toJwt();
        return NextResponse.json({ token: jwt, url: LIVEKIT.url, roomName });
    } catch (e) {
        console.error('[livekit/token] JWT error', e);
        return NextResponse.json({ error: 'Failed to issue LiveKit token' }, { status: 500 });
    }
}
