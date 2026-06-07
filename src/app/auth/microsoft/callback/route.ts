import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { getMicrosoftRedirectUri } from '@/config/microsoft';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

function getAppUrl(req: NextRequest) {
  return (ENV.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'https://alphaclonesystems.com').replace(
    /\/$/,
    ''
  );
}

function redirectWithStatus(appUrl: string, returnTo: string, status: 'connected' | 'error', reason?: string) {
  const url = new URL(returnTo, appUrl);
  url.searchParams.set('microsoft', status);
  if (reason) {
    url.searchParams.set('reason', reason);
  }
  return NextResponse.redirect(url.toString());
}

async function resolveReturnPath(state: string | null, fallback: string) {
  if (!state) {
    return fallback;
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: stateData } = await supabaseAdmin
    .from('oauth_states')
    .select('metadata')
    .eq('id', state)
    .maybeSingle();

  return (stateData?.metadata?.return_to as string | undefined) || fallback;
}

export async function GET(req: NextRequest) {
  const appUrl = getAppUrl(req);
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const rawError = searchParams.get('error_description') || searchParams.get('error');
  const error = rawError ? decodeURIComponent(rawError.replace(/\+/g, ' ')) : null;
  const defaultReturn = '/dashboard/settings';

  if (error) {
    const returnTo = await resolveReturnPath(state, defaultReturn);
    if (state) {
      const supabaseAdmin = createSupabaseAdminClient();
      await supabaseAdmin.from('oauth_states').delete().eq('id', state);
    }
    return redirectWithStatus(appUrl, returnTo, 'error', error);
  }

  if (!code || !state) {
    return redirectWithStatus(appUrl, defaultReturn, 'error', 'missing_params');
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: stateData, error: stateError } = await supabaseAdmin
      .from('oauth_states')
      .delete()
      .eq('id', state)
      .select('*')
      .single();

    if (stateError || !stateData) {
      console.error('[Microsoft Callback] Invalid state:', state);
      return redirectWithStatus(appUrl, defaultReturn, 'error', 'invalid_state');
    }

    const returnTo = (stateData.metadata?.return_to as string | undefined) || defaultReturn;
    const redirectUri =
      (stateData.metadata?.redirect_uri as string | undefined) || getMicrosoftRedirectUri(appUrl);
    const userId = stateData.user_id;

    const clientId = ENV.AZURE_CLIENT_ID || ENV.VITE_AZURE_CLIENT_ID;
    const clientSecret = ENV.AZURE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return redirectWithStatus(appUrl, returnTo, 'error', 'microsoft_oauth_not_configured');
    }

    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        // NOTE: No code_verifier — Web redirect URI flow uses client_secret, not PKCE.
      }),
    });

    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error('[Microsoft Callback] Token exchange failed:', tokenPayload);
      const message =
        tokenPayload.error_description || tokenPayload.error || 'Failed to exchange Microsoft code';
      return redirectWithStatus(appUrl, returnTo, 'error', message);
    }

    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });
    const profile = await profileResponse.json();

    const expiresAt = tokenPayload.expires_in
      ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
      : null;

    const { error: upsertError } = await supabaseAdmin.from('microsoft_connections').upsert(
      {
        user_id: userId,
        access_token: tokenPayload.access_token,
        refresh_token: tokenPayload.refresh_token,
        token_expiry: expiresAt,
        microsoft_email: profile.mail || profile.userPrincipalName || null,
        display_name: profile.displayName || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (upsertError) {
      throw upsertError;
    }

    return redirectWithStatus(appUrl, returnTo, 'connected');
  } catch (err: unknown) {
    console.error('[Microsoft Callback] Error:', err);
    const message = err instanceof Error ? err.message : 'callback_failed';
    return redirectWithStatus(appUrl, defaultReturn, 'error', message);
  }
}
