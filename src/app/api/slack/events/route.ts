import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { slackService } from '@/services/slackService';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = request.headers;
    
    // Verify Slack signature
    const timestamp = headers.get('x-slack-request-timestamp');
    const signature = headers.get('x-slack-signature');
    
    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const signingSecret = process.env.SLACK_SIGNING_SECRET!;
    const baseString = `v0:${timestamp}:${body}`;
    const expectedSignature = 'v0=' + crypto
      .createHmac('sha256', signingSecret)
      .update(baseString)
      .digest('hex');

    let isValid = false;
    try {
      isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      isValid = false;
    }
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    // Handle URL verification challenge
    if (event.type === 'url_verification') {
      return NextResponse.json({ challenge: event.challenge });
    }

    // Handle different event types
    switch (event.type) {
      case 'message':
        return await handleMessageEvent(event);
      
      case 'app_mention':
        return await handleMentionEvent(event);
      
      case 'team_join':
        return await handleTeamJoinEvent(event);
      
      default:
        console.log('[Slack Events] Unhandled event type:', event.type);
        return NextResponse.json({ status: 200 });
    }

  } catch (error) {
    console.error('[Slack Events] Error:', error);
    return NextResponse.json({ status: 500 });
  }
}

async function handleMessageEvent(event: any) {
  // Ignore bot messages
  if (event.bot_id || event.subtype === 'bot_message') {
    return NextResponse.json({ status: 200 });
  }

  const { text, user, channel, team } = event;
  
  // Log message for analytics
  console.log(`[Slack Events] Message from ${user} in ${channel}: ${text}`);
  
  // You can implement message-based automation here
  // For example: detect keywords, trigger workflows, etc.
  
  return NextResponse.json({ status: 200 });
}

async function handleMentionEvent(event: any) {
  const { text, user, channel, team } = event;
  
  // Get Slack integration
  const integration = await slackService.getSlackIntegration(team);
  if (!integration) {
    return NextResponse.json({ status: 200 });
  }

  // Send help message when bot is mentioned
  await slackService.sendMessage(integration, channel, {
    text: `👋 Hi <@${user}>! I'm AlphaClone bot. Use \`/alphaclone help\` to see available commands.`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `👋 Hi <@${user}>! I'm AlphaClone bot.`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Quick Commands:*\n• `/alphaclone help` - Show all commands\n• `/lead create <name>` - Create lead\n• `/meeting schedule` - Schedule meeting'
        }
      }
    ]
  });

  return NextResponse.json({ status: 200 });
}

async function handleTeamJoinEvent(event: any) {
  const { user, team } = event;
  
  // Get Slack integration
  const integration = await slackService.getSlackIntegration(team);
  if (!integration) {
    return NextResponse.json({ status: 200 });
  }

  // Send welcome message to new user
  await slackService.sendMessage(team, user, {
    text: '🎉 Welcome to AlphaClone!',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🎉 *Welcome to AlphaClone!*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'I\'m your business automation assistant. Here\'s what I can help you with:\n\n• 📊 Manage leads and opportunities\n• 📅 Schedule meetings and reminders\n• 🤖 Automate workflows\n• 📈 Send notifications and updates'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📖 Get Started'
            },
            url: 'https://alphaclonesystems.com/dashboard',
            action_id: 'get_started'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '❓ Help'
            },
            action_id: 'show_help'
          }
        ]
      }
    ]
  });

  return NextResponse.json({ status: 200 });
}
