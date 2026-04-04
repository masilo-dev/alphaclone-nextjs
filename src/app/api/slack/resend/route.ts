import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const { tenant_id, notification_id } = await request.json();

    if (!tenant_id || !notification_id) {
      return NextResponse.json(
        { error: 'Missing tenant_id or notification_id' },
        { status: 400 }
      );
    }

    // Get the original notification
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: notification, error } = await supabase
      .from('slack_notifications')
      .select('*')
      .eq('id', notification_id)
      .eq('tenant_id', tenant_id)
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
      .eq('tenant_id', tenant_id)
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
      .eq('id', notification_id);

    return NextResponse.json({
      success: true,
      message: 'Notification resent successfully',
      slack_response: slackData
    });

  } catch (error) {
    console.error('Slack resend error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
