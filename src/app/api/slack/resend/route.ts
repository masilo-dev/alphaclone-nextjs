import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const { tenant_id, tenantId: tenantIdInput, notification_id, notificationId } = await request.json();
    const tenantId = tenantIdInput || tenant_id;
    const notificationIdValue = notificationId || notification_id;

    if (!tenantId || !notificationIdValue) {
      return NextResponse.json(
        { error: 'Missing tenantId or notificationId' },
        { status: 400 }
      );
    }

    await requireTenantAccess(tenantId);

    // Get the original notification
    const supabase = createAdminSupabaseClientOrThrow();
    const { data: notification, error } = await supabase
      .from('slack_notifications')
      .select('*')
      .eq('id', notificationIdValue)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Get Slack integration for this tenant
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'slack')
      .eq('status', 'active')
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Slack integration not found or inactive' },
        { status: 404 }
      );
    }

    // Resend message to Slack
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: notification.channel,
        text: notification.message,
        username: 'AlphaClone Bot',
        icon_url: 'https://alphaclone.tech/logo.png'
      })
    });

    const slackData = await slackResponse.json();

    if (!slackData.ok) {
      return NextResponse.json(
        { error: 'Failed to resend Slack message', details: slackData.error },
        { status: 500 }
      );
    }

    // Update the notification status
    await supabase
      .from('slack_notifications')
      .update({
        status: 'resent',
        slack_message_id: slackData.ts,
        resent_at: new Date().toISOString()
      })
      .eq('id', notificationIdValue);

    return NextResponse.json({
      success: true,
      message: 'Notification resent successfully',
      slack_response: slackData
    });

  } catch (error) {
    return routeErrorResponse(error, 'Internal server error');
  }
}
