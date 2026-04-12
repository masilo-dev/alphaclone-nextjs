import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const ALLOWED_FB_RETURN = ['/dashboard/business/facebook', '/dashboard/business/settings'] as const;

type FacebookOAuthState = {
    userId: string;
    ts: number;
    tenantId?: string | null;
    returnTo?: string | null;
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

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || '').replace(/\/$/, '');

    if (error) {
        return redirectOAuthEarly(appUrl, error);
    }

    if (!code || !state) {
        return redirectOAuthEarly(appUrl, 'missing_params');
    }

    let stateData: FacebookOAuthState;
    try {
        stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
        return redirectOAuthEarly(appUrl, 'invalid_state');
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
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}&fields=id,name,access_token,tasks,category`
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

    if (pages.length > 0) {
        for (const page of pages) {
            const hasManageTask = Array.isArray(page.tasks) && (
                page.tasks.includes('MANAGE') ||
                page.tasks.includes('ADVERTISE') ||
                page.tasks.includes('CREATE_CONTENT')
            );

            await supabase.from('facebook_integrations').upsert({
                user_id: stateData.userId,
                tenant_id: resolvedTenantId,
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
        console.warn('[Facebook Callback] No pages returned for user:', stateData.userId);
        await supabase.from('facebook_integrations').upsert({
            user_id: stateData.userId,
            tenant_id: resolvedTenantId,
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

    return redirectOAuthComplete(appUrl, stateData, { ok: true });
}
