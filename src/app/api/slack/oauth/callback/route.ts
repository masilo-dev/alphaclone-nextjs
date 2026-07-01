import { NextRequest, NextResponse } from 'next/server';
import { parseOAuthState } from '@/lib/oauth/oauthState';
import { upsertSlackIntegration } from '@/services/slack/slackIntegrationService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('[Slack OAuth] Error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=missing_code`
      );
    }

    const stateData = parseOAuthState<{ tenantId: string; userId: string }>(state);
    if (!stateData?.tenantId || !stateData?.userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=invalid_state`
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
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=token_exchange_failed`
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
    const tenantId = stateData.tenantId;

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
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=database_error`
      );
    }

    console.log('[Slack OAuth] Integration saved successfully');

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?success=slack_connected`
    );

  } catch (error) {
    console.error('[Slack OAuth] Unexpected error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=unexpected_error`
    );
  }
}
