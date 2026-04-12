import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const { tenant_id, tenantId: tenantIdInput, message, channel = '#general' } = await request.json();
    const tenantId = tenantIdInput || tenant_id;

    if (!tenantId || !message) {
      return NextResponse.json(
        { error: 'Missing tenantId or message' },
        { status: 400 }
      );
    }

    await requireTenantAccess(tenantId);

    // Get Slack integration for this tenant
    const supabase = createAdminSupabaseClientOrThrow();
    const { data: integration, error } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'slack')
      .eq('status', 'active')
      .single();

    if (error || !integration) {
      return NextResponse.json(
        { error: 'Slack integration not found or inactive' },
        { status: 404 }
      );
    }

    // Send message to Slack
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channel,
        text: message,
        username: 'AlphaClone Bot',
        icon_url: 'https://alphaclone.tech/logo.png'
      })
    });

    const slackData = await slackResponse.json();

    if (!slackData.ok) {
      console.error('[slack/send] Slack API error:', slackData.error);
      return NextResponse.json(
        { error: 'Failed to send Slack message', code: 'SLACK_API_ERROR' },
        { status: 500 }
      );
    }

    // Log the notification
    await supabase
      .from('slack_notifications')
      .insert({
        tenant_id: tenantId,
        message,
        channel,
        slack_message_id: slackData.ts,
        status: 'sent',
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      slack_response: slackData
    });

  } catch (error) {
    return routeErrorResponse(error, 'Internal server error');
  }
}
