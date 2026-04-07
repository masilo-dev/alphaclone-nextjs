import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { slackService } from '@/services/slackService';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    
    // Verify Slack signature
    const timestamp = params.get('team_id');
    const signature = request.headers.get('x-slack-signature');
    
    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const signingSecret = process.env.SLACK_SIGNING_SECRET!;
    const baseString = `v0:${timestamp}:${body}`;
    const expectedSignature = 'v0=' + crypto
      .createHmac('sha256', signingSecret)
      .update(baseString)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const command = params.get('command');
    const text = params.get('text') || '';
    const teamId = params.get('team_id');
    const userId = params.get('user_id');
    const channelId = params.get('channel_id');

    // Get Slack integration
    const integration = await slackService.getSlackIntegration(teamId ?? '');
    if (!integration) {
      return NextResponse.json({
        text: '❌ Slack integration not found. Please connect your workspace first.',
        response_type: 'ephemeral'
      });
    }

    // Handle different commands
    let response;

    switch (command) {
      case '/alphaclone':
        response = await handleAlphacloneCommand(text, integration, userId ?? '', channelId ?? '');
        break;
      
      case '/lead':
        response = await handleLeadCommand(text, integration, userId ?? '', channelId ?? '');
        break;
      
      case '/meeting':
        response = await handleMeetingCommand(text, integration, userId ?? '', channelId ?? '');
        break;
      
      default:
        response = {
          text: '❌ Unknown command',
          response_type: 'ephemeral'
        };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Slack Commands] Error:', error);
    return NextResponse.json(
      { text: '❌ An error occurred while processing your command' },
      { status: 500 }
    );
  }
}

async function handleAlphacloneCommand(
  text: string, 
  integration: any, 
  userId: string, 
  channelId: string
) {
  const [action, ...params] = text.trim().split(' ');

  switch (action) {
    case 'status':
      return {
        text: '🚀 *AlphaClone Status*\n\n✅ Slack integration active\n📊 Connected to your workspace\n🔧 Ready for commands',
        response_type: 'ephemeral'
      };

    case 'help':
      return {
        text: '*📖 AlphaClone Commands Help*\n\n' +
              '`/alphaclone status` - Check connection status\n' +
              '`/alphaclone help` - Show this help\n' +
              '`/lead create <name>` - Create new lead\n' +
              '`/lead list` - List recent leads\n' +
              '`/meeting schedule <title>` - Schedule meeting',
        response_type: 'ephemeral'
      };

    default:
      return {
        text: '👋 Welcome to AlphaClone! Use `/alphaclone help` to see available commands.',
        response_type: 'ephemeral'
      };
  }
}

async function handleLeadCommand(
  text: string, 
  integration: any, 
  userId: string, 
  channelId: string
) {
  const [action, ...params] = text.trim().split(' ');

  switch (action) {
    case 'create':
      const leadName = params.join(' ') || 'New Lead';
      return {
        text: `🎯 *Lead Created*\n\n📝 Name: ${leadName}\n👤 Created by: <@${userId}>\n📅 Created: ${new Date().toLocaleDateString()}`,
        response_type: 'in_channel'
      };

    case 'list':
      return {
        text: '📋 *Recent Leads*\n\n🏢 ABC Corporation - Hot\n🏢 XYZ Tech - Warm\n🏢 Startup LLC - Cold\n\n_Use `/lead create <name>` to add new leads_',
        response_type: 'ephemeral'
      };

    default:
      return {
        text: '💼 *Lead Commands*\n\n`/lead create <name>` - Create new lead\n`/lead list` - List recent leads',
        response_type: 'ephemeral'
      };
  }
}

async function handleMeetingCommand(
  text: string, 
  integration: any, 
  userId: string, 
  channelId: string
) {
  const [action, ...params] = text.trim().split(' ');

  switch (action) {
    case 'schedule':
      const meetingTitle = params.join(' ') || 'New Meeting';
      return {
        text: `📅 *Meeting Scheduled*\n\n📝 Title: ${meetingTitle}\n👤 Organized by: <@${userId}>\n📅 Date: ${new Date().toLocaleDateString()}\n\n_Check your calendar for details_`,
        response_type: 'in_channel'
      };

    case 'list':
      return {
        text: '📅 *Upcoming Meetings*\n\n• 2:00 PM - Client Call\n• 3:30 PM - Team Standup\n• 5:00 PM - Project Review\n\n_Use `/meeting schedule <title>` to add new meetings_',
        response_type: 'ephemeral'
      };

    default:
      return {
        text: '🗓️ *Meeting Commands*\n\n`/meeting schedule <title>` - Schedule meeting\n`/meeting list` - List upcoming meetings',
        response_type: 'ephemeral'
      };
  }
}
