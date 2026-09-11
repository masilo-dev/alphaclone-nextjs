import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';
import { slackResendSchema } from '@/schemas/validation';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = slackResendSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const tenantId = parsed.data.tenantId || parsed.data.tenant_id!;
    const notificationIdValue = parsed.data.notificationId || parsed.data.notification_id!;

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
        { error: 'Notification not found', code: 'NOT_FOUND' },
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
        { error: 'Slack integration not found or inactive', code: 'INTEGRATION_NOT_FOUND' },
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
        icon_url: 'https://alphaclonesystems.com/logo.png'
      })
    });

    const slackData = await slackResponse.json();

    if (!slackData.ok) {
      console.error('[slack/resend] Slack API error:', slackData.error);
      return NextResponse.json(
        { error: 'Failed to resend Slack message', code: 'SLACK_API_ERROR' },
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
    return routeErrorResponse(error, 'Failed to resend Slack notification');
  }
}
