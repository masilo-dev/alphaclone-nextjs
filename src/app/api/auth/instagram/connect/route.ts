import { NextRequest, NextResponse } from 'next/server';
import { encodeOAuthState } from '@/lib/oauth/oauthState';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { PUBLIC_APP_ORIGIN } from '@/lib/config/public-origin';
import { OAUTH_CALLBACKS } from '@/lib/config/oauth-callbacks';

/**
 * Instagram Business OAuth connect.
 * Instagram Graph API uses Facebook OAuth — we request Instagram-specific scopes
 * (instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_messages)
 * alongside the page scopes needed to link a Facebook Page to its Instagram Business Account.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

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
        return NextResponse.json(
          { error: 'You are not a member of this workspace.' },
          { status: 403 },
        );
      }
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appUrl = PUBLIC_APP_ORIGIN;

    if (!appId) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/business/social?ig_error=app_not_configured`,
      );
    }

    const redirectUri = OAUTH_CALLBACKS.instagram;

    // Instagram Business API scopes (via Facebook Graph API)
    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'instagram_manage_insights',
    ].join(',');

    const state = encodeOAuthState({
      userId: user.id,
      tenantId: tenantIdParam,
      ts: Date.now(),
    });

    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    return NextResponse.redirect(authUrl.toString());
  } catch (err) {
    console.error('[instagram/connect] GET error:', err);
    return NextResponse.json(
      { error: 'OAuth initialization failed' },
      { status: 500 },
    );
  }
}
