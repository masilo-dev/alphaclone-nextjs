import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { publicAppUrl } from '@/lib/config/public-origin';
import { ENV } from '@/config/env';
import {
  exchangeCalcomCode,
  fetchCalcomMe,
  saveCalcomIntegration,
} from '@/services/calcom/calcomIntegrationService';

export const runtime = 'nodejs';

function redirectWithError(reason: string) {
  return NextResponse.redirect(
    publicAppUrl(`/dashboard/settings?tab=booking&error=${encodeURIComponent(reason)}`)
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('[cal/callback] OAuth error from Cal.com:', error);
    return redirectWithError(error);
  }

  if (!code || !state) {
    return redirectWithError('Missing authorization code or state');
  }

  const admin = createSupabaseAdminClient();

  // Consume and validate the state nonce (10-minute window)
  let { data: stateData, error: stateError } = await admin
    .from('oauth_states')
    .delete()
    .eq('id', state)
    .select('user_id, tenant_id, metadata, created_at')
    .single();

  if (stateError || !stateData) {
    const { data: maybeState } = await admin
      .from('oauth_states')
      .select('user_id, tenant_id, metadata, created_at')
      .eq('id', state)
      .maybeSingle();
    if (maybeState) {
      stateData = maybeState;
      stateError = null;
      await admin.from('oauth_states').delete().eq('id', state);
    }
  }

  const stateCreatedAt = stateData?.created_at
    ? new Date(stateData.created_at).getTime()
    : 0;

  if (
    stateError ||
    !stateData?.tenant_id ||
    !stateData?.user_id ||
    stateData.metadata?.provider !== 'calcom' ||
    !stateCreatedAt ||
    Date.now() - stateCreatedAt > 10 * 60_000
  ) {
    console.error('[cal/callback] Invalid or expired state:', { state, stateError, stateData });
    return redirectWithError('Invalid or expired OAuth state — please try connecting again');
  }

  const tenantId = stateData.tenant_id;
  const redirectUri =
    stateData.metadata?.redirect_uri ||
    ENV.CAL_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com'}/api/auth/cal/callback`;

  try {
    // Exchange code for tokens
    const tokenData = await exchangeCalcomCode(code, redirectUri);

    // Fetch Cal.com user profile
    const me = await fetchCalcomMe(tokenData.access_token);

    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in ?? 3600) * 1000
    ).toISOString();

    // Persist encrypted tokens + update tenant_integrations
    await saveCalcomIntegration(admin, tenantId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      calcomUserId: me.id,
      email: me.email,
      username: me.username,
    });

    // Audit log
    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'integration_connected',
      payload: {
        integrationId: 'calcom',
        actorUserId: stateData.user_id,
        calcomEmail: me.email,
        calcomUsername: me.username,
      },
    });

    return NextResponse.redirect(
      publicAppUrl('/dashboard/settings?tab=booking&success=calcom_connected')
    );
  } catch (err: unknown) {
    console.error('[cal/callback] Error:', err);
    const msg = err instanceof Error ? err.message : 'calcom_callback_failed';
    return redirectWithError(msg);
  }
}
