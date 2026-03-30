import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || '').replace(/\/$/, '');

    if (error) {
        return NextResponse.redirect(`${appUrl}/dashboard/business/settings?tab=integrations&fb_error=${error}`);
    }

    if (!code || !state) {
        return NextResponse.redirect(`${appUrl}/dashboard/business/settings?tab=integrations&fb_error=missing_params`);
    }

    let stateData: { userId: string; ts: number };
    try {
        stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
        return NextResponse.redirect(`${appUrl}/dashboard/business/settings?tab=integrations&fb_error=invalid_state`);
    }

    const appId = process.env.FACEBOOK_APP_ID!;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const redirectUri = `${appUrl}/api/auth/facebook/callback`;

    // Exchange code for access token
    const tokenRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
        return NextResponse.redirect(`${appUrl}/dashboard/business/settings?tab=integrations&fb_error=token_exchange_failed`);
    }

    // Get long-lived token
    const longLivedRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    );
    const longLivedData = await longLivedRes.json();
    const userToken = longLivedData.access_token || tokenData.access_token;

    // Get user's Facebook Pages
    const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}&fields=id,name,access_token`
    );
    const pagesData = await pagesRes.json();

    // Get user profile
    const profileRes = await fetch(
        `https://graph.facebook.com/v19.0/me?access_token=${userToken}&fields=id,name`
    );
    const profileData = await profileRes.json();

    const supabase = createSupabaseAdminClient();

    // Get tenant_id
    const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', stateData.userId)
        .single();

    // Save each page or the user token
    const pages = pagesData.data || [];
    if (pages.length > 0) {
        for (const page of pages) {
            await supabase.from('facebook_integrations').upsert({
                user_id: stateData.userId,
                tenant_id: tenantUser?.tenant_id,
                page_id: page.id,
                page_name: page.name,
                page_access_token: page.access_token,
                user_access_token: userToken,
                app_scoped_user_id: profileData.id,
                is_active: true,
                connected_at: new Date().toISOString(),
                expires_at: longLivedData.expires_in
                    ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
                    : null,
                metadata: { fb_name: profileData.name, page_count: pages.length },
            }, { onConflict: 'user_id,page_id' });
        }
    } else {
        // No pages — save user-level token
        await supabase.from('facebook_integrations').upsert({
            user_id: stateData.userId,
            tenant_id: tenantUser?.tenant_id,
            page_id: profileData.id,
            page_name: profileData.name,
            user_access_token: userToken,
            app_scoped_user_id: profileData.id,
            is_active: true,
            connected_at: new Date().toISOString(),
            metadata: { fb_name: profileData.name, no_pages: true },
        }, { onConflict: 'user_id,page_id' });
    }

    return NextResponse.redirect(`${appUrl}/dashboard/business/settings?tab=integrations&fb_connected=true`);
}
