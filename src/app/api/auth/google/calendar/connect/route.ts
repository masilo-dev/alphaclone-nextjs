import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { OAUTH_CALLBACKS } from '@/lib/config/oauth-callbacks';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || '';
    try {
        const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);
        const userId = user.id;
        if (!ENV.GOOGLE_CLIENT_ID || !ENV.GOOGLE_CLIENT_SECRET) {
            return NextResponse.json({ error: 'Google Calendar OAuth is not configured' }, { status: 503 });
        }
        const supabaseAdmin = createSupabaseAdminClient();

        // 1. Generate and persist new secure state
        const { data: stateRecord, error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .insert({ user_id: userId, tenant_id: tenantId })
            .select('id')
            .single();

        if (stateError || !stateRecord) {
            console.error('Failed to create OAuth state:', stateError);
            return NextResponse.json({ error: 'Failed to initialize secure connection' }, { status: 500 });
        }

        const stateNonce = stateRecord.id;
        const clientId = ENV.GOOGLE_CLIENT_ID;
<<<<<<< HEAD
        const redirectUri = OAUTH_CALLBACKS.googleCalendar;
=======
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
        const redirectUri = `${appUrl}/api/auth/google/calendar/callback`;
>>>>>>> origin/main

        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/drive.file',
            'openid'
        ].join(' ');

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent(scopes)}&` +
            `access_type=offline&` +
            `prompt=consent&` +
            `state=${stateNonce}`;

        return NextResponse.redirect(authUrl);
    } catch (err: any) {
        console.error('Google Calendar Connect Error:', err);
        return routeErrorResponse(err, 'Google Calendar authorization could not be started', req);
    }
}
