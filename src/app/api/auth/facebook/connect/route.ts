import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantIdParam = req.nextUrl.searchParams.get('tenant_id')?.trim() || null;
    if (tenantIdParam) {
        const { data: member, error: memErr } = await supabase
            .from('tenant_users')
            .select('tenant_id')
            .eq('user_id', user.id)
            .eq('tenant_id', tenantIdParam)
            .maybeSingle();
        if (memErr || !member) {
            return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
        }
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/\/$/, '');
    if (!appId) {
        return NextResponse.redirect(
            `${appUrl}/dashboard/business/facebook?fb_error=app_not_configured`
        );
    }

    const redirectUri = `${appUrl}/api/auth/facebook/callback`;
    const scopes = [
        'pages_show_list',
        'pages_read_engagement',
        'pages_read_user_content',
        'pages_manage_posts',       // required to post content to page
        'pages_manage_engagement',  // required to comment on posts
        'pages_messaging',          // required for Messenger send
        'leads_retrieval',
        'ads_management',
        // Instagram scopes added to unify Facebook and Instagram connection
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_comments',
        'instagram_manage_insights',
        'instagram_manage_messages',
    ].join(',');

    const ALLOWED_RETURN = ['/dashboard/business/facebook', '/dashboard/business/settings'] as const;
    const returnToRaw = req.nextUrl.searchParams.get('return_to')?.trim();
    let returnTo: string | null = null;
    if (returnToRaw) {
        const pathOnly = returnToRaw.split('?')[0];
        if ((ALLOWED_RETURN as readonly string[]).includes(pathOnly)) {
            returnTo = pathOnly;
        }
    }

    const state = Buffer.from(
        JSON.stringify({
            userId: user.id,
            tenantId: tenantIdParam,
            ts: Date.now(),
            returnTo,
        })
    ).toString('base64url');

    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    return NextResponse.redirect(authUrl.toString());
    } catch (err) {
        console.error('[facebook/connect] GET error:', err);
        return NextResponse.json({ error: 'OAuth initialization failed' }, { status: 500 });
    }
}
