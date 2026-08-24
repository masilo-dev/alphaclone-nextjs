import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { parseOAuthState } from '@/lib/oauth/oauthState';
import { upsertFacebookIntegration } from '@/services/facebook/facebookIntegrationService';
import { upsertInstagramIntegration } from '@/services/instagram/instagramIntegrationService';
import { PUBLIC_APP_ORIGIN } from '@/lib/config/public-origin';

const ALLOWED_FB_RETURN = ['/dashboard/business/facebook', '/dashboard/business/settings'] as const;

type FacebookOAuthState = {
    userId: string;
    ts: number;
    tenantId?: string | null;
    returnTo?: string | null;
    scopeMode?: 'publishing' | 'advanced';
    requestedScopes?: string[];
};

function redirectOAuthEarly(appUrl: string, fbError: string): NextResponse {
    const u = new URL('/dashboard/business/settings', appUrl);
    u.searchParams.set('tab', 'integrations');
    u.searchParams.set('fb_error', fbError);
    return NextResponse.redirect(u.toString());
}

function redirectOAuthComplete(
    appUrl: string,
    stateData: FacebookOAuthState | null,
    result: { ok: true } | { ok: false; fbError: string }
): NextResponse {
    const path =
        stateData?.returnTo &&
        (ALLOWED_FB_RETURN as readonly string[]).includes(stateData.returnTo)
            ? stateData.returnTo
            : '/dashboard/business/settings';
    const u = new URL(path, appUrl);
    if (path === '/dashboard/business/settings') {
        u.searchParams.set('tab', 'integrations');
    }
    if (result.ok) {
        u.searchParams.set('fb_connected', 'true');
    } else {
        u.searchParams.set('fb_error', result.fbError);
    }
    return NextResponse.redirect(u.toString());
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const appUrl = PUBLIC_APP_ORIGIN;

    if (error) {
        return redirectOAuthEarly(appUrl, error);
    }

    if (!code || !state) {
        return redirectOAuthEarly(appUrl, 'missing_params');
    }

    const stateData = parseOAuthState<FacebookOAuthState>(state);
    if (!stateData?.userId) {
        return redirectOAuthEarly(appUrl, 'invalid_state');
    }

    const supabaseServer = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabaseServer.auth.getUser();
    if (!user || user.id !== stateData.userId) {
        return redirectOAuthComplete(appUrl, stateData, { ok: false, fbError: 'session_mismatch' });
    }

    const appId = process.env.FACEBOOK_APP_ID!;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const redirectUri = `${appUrl}/api/auth/facebook/callback`;

    const tokenRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
        console.error('[Facebook Callback] Token exchange failed:', tokenData);
        return redirectOAuthComplete(appUrl, stateData, { ok: false, fbError: 'token_exchange_failed' });
    }

    const longLivedRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    );
    const longLivedData = await longLivedRes.json();
    if (!longLivedRes.ok || !longLivedData.access_token) {
        console.error('[Facebook Callback] Long-lived token exchange failed:', longLivedData);
        return redirectOAuthComplete(appUrl, stateData, { ok: false, fbError: 'token_refresh_failed' });
    }
    const userToken = longLivedData.access_token;

    const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}&fields=id,name,access_token,tasks,category,instagram_business_account`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
        console.error('[Facebook Callback] Failed to fetch pages:', pagesData.error);
    }

    const profileRes = await fetch(
        `https://graph.facebook.com/v19.0/me?access_token=${userToken}&fields=id,name,email`
    );
    const profileData = await profileRes.json();

    const supabase = createSupabaseAdminClient();

    let resolvedTenantId: string | null = stateData.tenantId?.trim() || null;
    if (resolvedTenantId) {
        const { data: mem } = await supabase
            .from('tenant_users')
            .select('tenant_id')
            .eq('user_id', stateData.userId)
            .eq('tenant_id', resolvedTenantId)
            .maybeSingle();
        if (!mem?.tenant_id) resolvedTenantId = null;
    }
    if (!resolvedTenantId) {
        const { data: first } = await supabase
            .from('tenant_users')
            .select('tenant_id')
            .eq('user_id', stateData.userId)
            .limit(1)
            .maybeSingle();
        resolvedTenantId = first?.tenant_id ?? null;
    }

    const pages = pagesData.data || [];
    const fbUserId = profileData?.id != null ? String(profileData.id) : null;
    if (!fbUserId) {
        console.error('[Facebook Callback] Missing Facebook user id from /me:', profileData);
        return redirectOAuthComplete(appUrl, stateData, { ok: false, fbError: 'profile_failed' });
    }

    const expiresAt = longLivedData.expires_in
        ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
        : null;

    let upsertFailures = 0;

    if (pages.length > 0) {
        for (const page of pages) {
            const hasManageTask = Array.isArray(page.tasks) && (
                page.tasks.includes('MANAGE') ||
                page.tasks.includes('ADVERTISE') ||
                page.tasks.includes('CREATE_CONTENT')
            );

            const fbResult = await upsertFacebookIntegration({
                userId: stateData.userId,
                tenantId: resolvedTenantId,
                pageId: String(page.id),
                pageName: page.name,
                pageAccessToken: page.access_token || null,
                userAccessToken: userToken,
                appScopedUserId: fbUserId,
                expiresAt,
                metadata: {
                    fb_name: profileData.name,
                    fb_email: profileData.email || null,
                    page_count: pages.length,
                    page_category: page.category || null,
                    page_tasks: page.tasks || [],
                    can_post: hasManageTask,
                    scope_mode: stateData.scopeMode || 'publishing',
                    requested_scopes: stateData.requestedScopes || [],
                },
            });
            if (!fbResult.integrationId) {
                console.error('[Facebook Callback] facebook_integrations upsert failed:', fbResult.error);
                upsertFailures += 1;
            }

            if (page.instagram_business_account?.id) {
                const igId = page.instagram_business_account.id;
                const igRes = await fetch(
                    `https://graph.facebook.com/v19.0/${igId}?fields=username,name,profile_picture_url,followers_count,media_count&access_token=${page.access_token}`
                );
                const igData = await igRes.json();

                if (!igData.error && page.access_token) {
                    const igResult = await upsertInstagramIntegration({
                        userId: stateData.userId,
                        tenantId: resolvedTenantId,
                        instagramAccountId: igId,
                        username: igData.username || null,
                        accountName: igData.name || null,
                        profilePictureUrl: igData.profile_picture_url || null,
                        facebookPageId: String(page.id),
                        facebookPageName: page.name,
                        pageAccessToken: page.access_token,
                        followersCount: igData.followers_count || 0,
                        mediaCount: igData.media_count || 0,
                        expiresAt,
                    });
                    if (!igResult.integrationId) {
                        console.error('[Facebook Callback] instagram_integrations upsert failed:', igResult.error);
                    }
                }
            }
        }
    } else {
        console.warn('[Facebook Callback] No pages returned for user:', stateData.userId);
        const fbResult = await upsertFacebookIntegration({
            userId: stateData.userId,
            tenantId: resolvedTenantId,
            pageId: fbUserId,
            pageName: profileData.name || 'Facebook profile',
            pageAccessToken: null,
            userAccessToken: userToken,
            appScopedUserId: fbUserId,
            expiresAt,
            metadata: {
                fb_name: profileData.name,
                no_pages: true,
                warning: 'No pages found. User may not have granted pages_show_list or has no Facebook Pages.',
                scope_mode: stateData.scopeMode || 'publishing',
                requested_scopes: stateData.requestedScopes || [],
            },
        });
        if (!fbResult.integrationId) {
            console.error('[Facebook Callback] facebook_integrations upsert (no pages) failed:', fbResult.error);
            upsertFailures += 1;
        }
    }

    const allPageUpsertsFailed = pages.length > 0 && upsertFailures >= pages.length;
    const noPageRowFailed = pages.length === 0 && upsertFailures > 0;
    if (allPageUpsertsFailed || noPageRowFailed) {
        return redirectOAuthComplete(appUrl, stateData, { ok: false, fbError: 'save_failed' });
    }

    if (resolvedTenantId) {
        await supabase.from('tenant_integrations').upsert(
            {
                tenant_id: resolvedTenantId,
                integration_id: stateData.scopeMode === 'advanced' ? 'facebook-advanced' : 'facebook-publishing',
                status: 'connected',
                connected_at: new Date().toISOString(),
                configured_by: stateData.userId,
                metadata: {
                    pages_connected: pages.length,
                    scope_mode: stateData.scopeMode || 'publishing',
                    requested_scopes: stateData.requestedScopes || [],
                },
            },
            { onConflict: 'tenant_id,integration_id' }
        );
    }

    return redirectOAuthComplete(appUrl, stateData, { ok: true });
}
