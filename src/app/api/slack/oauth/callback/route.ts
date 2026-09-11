import { NextRequest, NextResponse } from 'next/server';
import { upsertSlackIntegration } from '@/services/slack/slackIntegrationService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/\/$/, '');
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('[Slack OAuth] Error:', error);
      return NextResponse.redirect(
        `${appUrl}/dashboard/marketplace?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/marketplace?error=missing_code`
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: stateData, error: stateError } = await admin.from('oauth_states')
      .delete().eq('id', state).select('user_id, tenant_id, metadata, created_at').single();
    const stateCreatedAt = stateData?.created_at ? new Date(stateData.created_at).getTime() : 0;
    if (stateError || !stateData?.tenant_id || !stateData?.user_id || stateData.metadata?.provider !== 'slack' || !stateCreatedAt || Date.now() - stateCreatedAt > 10 * 60_000) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/marketplace?error=invalid_state`
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.SLACK_REDIRECT_URI!,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error('[Slack OAuth] Token exchange failed:', tokenData);
      return NextResponse.redirect(
        `${appUrl}/dashboard/marketplace?error=token_exchange_failed`
      );
    }

    // Get team info
    const teamInfo = await fetch('https://slack.com/api/team.info', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const teamData = await teamInfo.json();
    const tenantId = stateData.tenant_id;

    const { integrationId, error: saveError } = await upsertSlackIntegration({
      tenantId,
      teamId: tokenData.team.id,
      teamName: teamData.team?.name || tokenData.team.name,
      botUserId: tokenData.bot_user_id,
      botAccessToken: tokenData.access_token,
      userAccessToken: tokenData.authed_user?.access_token ?? null,
      webhookUrl: tokenData.incoming_webhook?.url ?? null,
      defaultChannel: tokenData.incoming_webhook?.channel_id,
      scope: tokenData.scope,
    });

    if (!integrationId || saveError) {
      console.error('[Slack OAuth] Database error:', saveError);
      return NextResponse.redirect(
        `${appUrl}/dashboard/marketplace?error=database_error`
      );
    }

    const { error: connectionError } = await admin.from('tenant_integrations').upsert({
      tenant_id: tenantId,
      integration_id: 'slack',
      status: 'connected',
      connected_at: new Date().toISOString(),
      configured_by: stateData.user_id,
      metadata: { teamId: tokenData.team.id, teamName: teamData.team?.name || tokenData.team.name },
    }, { onConflict: 'tenant_id,integration_id' });
    if (connectionError) throw connectionError;
    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'integration_connected',
      payload: { integrationId: 'slack', actorUserId: stateData.user_id },
    });

    console.log('[Slack OAuth] Integration saved successfully');

    return NextResponse.redirect(
      `${appUrl}/dashboard/marketplace?success=slack_connected`
    );

  } catch (error) {
    console.error('[Slack OAuth] Unexpected error:', error);
    return NextResponse.redirect(
      `${appUrl}/dashboard/marketplace?error=unexpected_error`
    );
  }
}
