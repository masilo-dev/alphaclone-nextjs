import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { slackService } from '@/services/slackService';

export async function POST(request: NextRequest) {
  try {
    const { code, state, error } = await request.json();

    if (error) {
      console.error('[Slack OAuth] Error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=missing_code`
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
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const teamData = await teamInfo.json();

    // Save integration to database
    const supabase = createSupabaseAdminClient();
    
    // Get tenant from state or use default
    const tenantId = state || 'default';

    const { error: dbError } = await supabase
      .from('slack_integrations')
      .upsert({
        tenant_id: tenantId,
        team_id: tokenData.team.id,
        team_name: teamData.team?.name || tokenData.team.name,
        bot_user_id: tokenData.bot_user_id,
        bot_access_token: tokenData.access_token,
        user_access_token: tokenData.authed_user?.access_token,
        webhook_url: tokenData.incoming_webhook?.url,
        default_channel: tokenData.incoming_webhook?.channel_id,
        scope: tokenData.scope,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('[Slack OAuth] Database error:', dbError);
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
