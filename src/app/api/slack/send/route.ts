import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const { tenant_id, message, channel = '#general' } = await request.json();

    if (!tenant_id || !message) {
      return NextResponse.json(
        { error: 'Missing tenant_id or message' },
        { status: 400 }
      );
    }

    // Get Slack integration for this tenant
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: integration, error } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenant_id)
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
      return NextResponse.json(
        { error: 'Failed to send Slack message', details: slackData.error },
        { status: 500 }
      );
    }

    // Log the notification
    await supabase
      .from('slack_notifications')
      .insert({
        tenant_id,
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
    console.error('Slack send error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
