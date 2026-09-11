import { NextRequest, NextResponse } from 'next/server';
import { parseOAuthState } from '@/lib/oauth/oauthState';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { upsertInstagramIntegration } from '@/services/instagram/instagramIntegrationService';
import { PUBLIC_APP_ORIGIN } from '@/lib/config/public-origin';

type InstagramOAuthState = {
  userId: string;
  ts: number;
  tenantId?: string | null;
};

function redirectError(appUrl: string, igError: string): NextResponse {
  const u = new URL('/dashboard/business/instagram', appUrl);
  u.searchParams.set('ig_error', igError);
  return NextResponse.redirect(u.toString());
}

function redirectSuccess(appUrl: string): NextResponse {
  const u = new URL('/dashboard/business/instagram', appUrl);
  u.searchParams.set('ig_connected', 'true');
  return NextResponse.redirect(u.toString());
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = PUBLIC_APP_ORIGIN;

  if (error) return redirectError(appUrl, error);
  if (!code || !state) return redirectError(appUrl, 'missing_params');

  const stateData = parseOAuthState<InstagramOAuthState>(state);
  if (!stateData?.userId) {
    return redirectError(appUrl, 'invalid_state');
  }

  const supabaseServer = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  if (!user || user.id !== stateData.userId) {
    return redirectError(appUrl, 'session_mismatch');
  }

  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;
  const redirectUri = `${appUrl}/api/auth/instagram/callback`;

  // 1. Exchange code for short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
  );
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    return redirectError(appUrl, tokenData.error?.message || 'token_exchange_failed');
  }

  // 2. Exchange for long-lived token
  const longLivedRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
  );
  const longLivedData = await longLivedRes.json();
  if (!longLivedRes.ok || !longLivedData.access_token) {
    return redirectError(appUrl, longLivedData.error?.message || 'token_refresh_failed');
  }
  const userToken = longLivedData.access_token;

  // 3. Get user's Facebook Pages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${userToken}&fields=id,name,access_token,instagram_business_account`
  );
  const pagesData = await pagesRes.json();
  if (!pagesRes.ok || !Array.isArray(pagesData.data)) {
    return redirectError(appUrl, pagesData.error?.message || 'pages_fetch_failed');
  }

  // 4. Get FB user profile
  const userRes = await fetch(
    `https://graph.facebook.com/v21.0/me?access_token=${userToken}&fields=id,name`
  );
  const profileData = await userRes.json();
  const fbUserId = profileData?.id ? String(profileData.id) : null;

  if (!fbUserId) {
    return redirectError(appUrl, 'profile_failed');
  }

  const supabase = createSupabaseAdminClient();

  // Resolve tenant
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

  const pages: Array<Record<string, any>> = pagesData.data || [];
  let connectedCount = 0;

  for (const page of pages) {
    const igAccount = page.instagram_business_account;
    if (!igAccount?.id) continue; // page has no linked Instagram Business Account

    // 5. Fetch Instagram Business Account details
    const igRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccount.id}?fields=id,username,name,profile_picture_url,followers_count,media_count&access_token=${page.access_token}`,
    );
    const igData = await igRes.json();

    if (igData.error || !igData.id) {
      console.error('[Instagram Callback] Failed to fetch IG account:', igData.error);
      continue;
    }

    const igResult = await upsertInstagramIntegration({
      userId: stateData.userId,
      tenantId: resolvedTenantId,
      instagramAccountId: String(igData.id),
      username: igData.username || null,
      accountName: igData.name || page.name || null,
      profilePictureUrl: igData.profile_picture_url || null,
      facebookPageId: String(page.id),
      facebookPageName: page.name || '',
      pageAccessToken: page.access_token,
      followersCount: igData.followers_count ?? 0,
      mediaCount: igData.media_count ?? 0,
      expiresAt: longLivedData.expires_in
        ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
        : null,
    });

    if (igResult.error) {
      console.error('[Instagram Callback] instagram_integrations upsert failed:', igResult.error);
    } else {
      connectedCount++;
    }
  }

  if (pages.length > 0 && connectedCount === 0) {
    // Pages found but none had an Instagram Business Account linked
    return redirectError(appUrl, 'no_instagram_business_account');
  }

  if (pages.length === 0) {
    return redirectError(appUrl, 'no_pages');
  }

  // 6. Mark integration in tenant_integrations
  if (resolvedTenantId) {
    await supabase.from('tenant_integrations').upsert(
      {
        tenant_id: resolvedTenantId,
        integration_id: 'instagram',
        status: 'connected',
        connected_at: new Date().toISOString(),
        configured_by: stateData.userId,
        metadata: { accounts_connected: connectedCount },
      },
      { onConflict: 'tenant_id,integration_id' },
    );
  }

  return redirectSuccess(appUrl);
}
