import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

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

    let stateData: { userId: string; ts: number; tenantId?: string | null };
    try {
        stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
        return NextResponse.redirect(`${appUrl}/dashboard/business/settings?tab=integrations&fb_error=invalid_state`);
    }

    const appId = process.env.FACEBOOK_APP_ID!;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const redirectUri = `${appUrl}/api/auth/facebook/callback`;

    // Step 1: Exchange code for short-lived user access token
    const tokenRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
        console.error('[Facebook Callback] Token exchange failed:', tokenData);
        return NextResponse.redirect(`${appUrl}/dashboard/business/settings?tab=integrations&fb_error=token_exchange_failed`);
    }

    // Step 2: Exchange for long-lived user access token (60-day token)
    const longLivedRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    );
    const longLivedData = await longLivedRes.json();
    if (!longLivedRes.ok || !longLivedData.access_token) {
        console.error('[Facebook Callback] Long-lived token exchange failed:', longLivedData);
        return NextResponse.redirect(`${appUrl}/dashboard/business/settings?tab=integrations&fb_error=token_refresh_failed`);
    }
    const userToken = longLivedData.access_token;

    // Step 3: Fetch the user's Pages with their individual Page Access Tokens.
    // IMPORTANT: We request `tasks` so we can verify the user has MANAGE/ADVERTISE
    // permission on each page, which is required for pages_manage_posts to work.
    // Page Access Tokens returned here are long-lived (never expire while the user token is valid).
    const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}&fields=id,name,access_token,tasks,category`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
        console.error('[Facebook Callback] Failed to fetch pages:', pagesData.error);
    }

    // Step 4: Get user profile
    const profileRes = await fetch(
        `https://graph.facebook.com/v19.0/me?access_token=${userToken}&fields=id,name,email`
    );
    const profileData = await profileRes.json();

    const supabase = createSupabaseAdminClient();

    // Get tenant_id
    const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', stateData.userId)
        .single();

    const pages = pagesData.data || [];

    if (pages.length > 0) {
        for (const page of pages) {
            // page.access_token is a Page Access Token — this is what must be used
            // for pages_manage_posts and pages_read_engagement. Using the user token
            // instead will cause the "requires pages_manage_posts" error.
            const hasManageTask = Array.isArray(page.tasks) && (
                page.tasks.includes('MANAGE') ||
                page.tasks.includes('ADVERTISE') ||
                page.tasks.includes('CREATE_CONTENT')
            );

            await supabase.from('facebook_integrations').upsert({
                user_id: stateData.userId,
                tenant_id: tenantUser?.tenant_id,
                page_id: page.id,
                page_name: page.name,
                // Always store the Page Access Token — never use the user token for page actions
                page_access_token: page.access_token,
                user_access_token: userToken,
                app_scoped_user_id: profileData.id,
                is_active: true,
                connected_at: new Date().toISOString(),
                expires_at: longLivedData.expires_in
                    ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
                    : null,
                metadata: {
                    fb_name: profileData.name,
                    fb_email: profileData.email || null,
                    page_count: pages.length,
                    page_category: page.category || null,
                    page_tasks: page.tasks || [],
                    can_post: hasManageTask,
                },
            }, { onConflict: 'user_id,page_id' });
        }
    } else {
        // No pages returned — this means the user either has no pages or
        // did not grant pages_show_list. Save user-level token as fallback
        // but flag that posting may not work.
        console.warn('[Facebook Callback] No pages returned for user:', stateData.userId);
        await supabase.from('facebook_integrations').upsert({
            user_id: stateData.userId,
            tenant_id: tenantUser?.tenant_id,
            page_id: profileData.id,
            page_name: profileData.name,
            page_access_token: null,
            user_access_token: userToken,
            app_scoped_user_id: profileData.id,
            is_active: true,
            connected_at: new Date().toISOString(),
            metadata: {
                fb_name: profileData.name,
                no_pages: true,
                warning: 'No pages found. User may not have granted pages_show_list or has no Facebook Pages.',
            },
        }, { onConflict: 'user_id,page_id' });
    }

    if (resolvedTenantId) {
        await supabase.from('tenant_integrations').upsert(
            {
                tenant_id: resolvedTenantId,
                integration_id: 'facebook-leads',
                status: 'connected',
                connected_at: new Date().toISOString(),
                configured_by: stateData.userId,
                metadata: { pages_connected: pages.length },
            },
            { onConflict: 'tenant_id,integration_id' }
        );
    }

    return NextResponse.redirect(`${appUrl}/dashboard/business/settings?tab=integrations&fb_connected=true`);
}
