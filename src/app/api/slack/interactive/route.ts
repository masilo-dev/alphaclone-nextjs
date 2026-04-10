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

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const { type, team, user, channel, actions } = payload;

    // Get Slack integration
    const integration = await slackService.getSlackIntegration(team);
    if (!integration) {
      return NextResponse.json({ status: 200 });
    }

    // Handle different interaction types
    switch (type) {
      case 'block_actions':
        return await handleBlockActions(payload, integration);
      
      case 'view_submission':
        return await handleViewSubmission(payload, integration);
      
      case 'shortcut':
        return await handleShortcut(payload, integration);
      
      default:
        console.log('[Slack Interactive] Unhandled type:', type);
        return NextResponse.json({ status: 200 });
    }

  } catch (error) {
    console.error('[Slack Interactive] Error:', error);
    return NextResponse.json({ status: 500 });
  }
}

async function handleBlockActions(payload: any, integration: any) {
  const { actions, user, channel } = payload;

  for (const action of actions) {
    switch (action.action_id) {
      case 'get_started':
        await slackService.sendMessage(integration, channel, {
          text: `🚀 <@${user}> is getting started with AlphaClone! Check out the dashboard: https://alphaclone.tech/dashboard`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🚀 <@${user}> clicked "Get Started"!\n\nVisit the dashboard to explore all features: https://alphaclone.tech/dashboard`
              }
            }
          ]
        });
        break;

      case 'show_help':
        await slackService.sendMessage(integration, channel, {
          text: `📖 <@${user}> requested help!`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `📖 *AlphaClone Help for <@${user}>*\n\n**Available Commands:**\n• \`/alphaclone help\` - Show all commands\n• \`/lead create <name>\` - Create new lead\n• \`/lead list\` - List recent leads\n• \`/meeting schedule <title>\` - Schedule meeting\n\n**Features:**\n• 📊 Lead management\n• 📅 Meeting scheduling\n• 🤖 Workflow automation\n• 📈 Real-time notifications\n\nNeed more help? Visit: https://alphaclone.tech/support`
              }
            }
          ]
        });
        break;

      case 'create_lead_quick':
        // Open a modal for quick lead creation
        return NextResponse.json({
          trigger_id: payload.trigger_id,
          view: {
            type: 'modal',
            callback_id: 'create_lead_modal',
            title: {
              type: 'plain_text',
              text: 'Create New Lead'
            },
            blocks: [
              {
                type: 'input',
                block_id: 'lead_name',
                element: {
                  type: 'plain_text_input',
                  action_id: 'name_input',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Enter lead name'
                  }
                },
                label: {
                  type: 'plain_text',
                  text: 'Lead Name'
                }
              },
              {
                type: 'input',
                block_id: 'lead_email',
                element: {
                  type: 'plain_text_input',
                  action_id: 'email_input',
                  placeholder: {
                    type: 'plain_text',
                    text: 'email@example.com'
                  }
                },
                label: {
                  type: 'plain_text',
                  text: 'Email Address'
                }
              },
              {
                type: 'input',
                block_id: 'lead_company',
                element: {
                  type: 'plain_text_input',
                  action_id: 'company_input',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Company name'
                  }
                },
                label: {
                  type: 'plain_text',
                  text: 'Company'
                }
              }
            ],
            submit: {
              type: 'plain_text',
              text: 'Create Lead'
            }
          }
        });

      default:
        console.log('[Slack Interactive] Unknown action:', action.action_id);
    }
  }

  return NextResponse.json({ status: 200 });
}

async function handleViewSubmission(payload: any, integration: any) {
  const { view, user } = payload;

  switch (view.callback_id) {
    case 'create_lead_modal':
      const nameInput = view.state.values.lead_name.name_input.value;
      const emailInput = view.state.values.lead_email.email_input.value;
      const companyInput = view.state.values.lead_company.company_input.value;

      // Here you would save the lead to your database
      console.log('[Slack Modal] Creating lead:', { nameInput, emailInput, companyInput });

      // Send confirmation message
      await slackService.sendMessage(integration, view.private_metadata, {
        text: `✅ Lead created successfully!`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *Lead Created by <@${user}>*\n\n📝 **Name:** ${nameInput}\n📧 **Email:** ${emailInput}\n🏢 **Company:** ${companyInput}\n\nView all leads in the dashboard: https://alphaclone.tech/dashboard/crm`
            }
          }
        ]
      });

      return NextResponse.json({
        response_action: 'clear'
      });

    default:
      return NextResponse.json({
        response_action: 'clear'
      });
  }
}

async function handleShortcut(payload: any, integration: any) {
  const { callback_id, trigger_id, user } = payload;

  switch (callback_id) {
    case 'quick_lead':
      // Open quick lead creation modal
      return NextResponse.json({
        trigger_id,
        view: {
          type: 'modal',
          callback_id: 'create_lead_modal',
          title: {
            type: 'plain_text',
            text: 'Quick Lead'
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '🎯 *Quick Lead Creation*\n\nFill in the details below to create a new lead.'
              }
            },
            {
              type: 'input',
              block_id: 'lead_name',
              element: {
                type: 'plain_text_input',
                action_id: 'name_input',
                placeholder: {
                  type: 'plain_text',
                  text: 'Enter lead name'
                }
              },
              label: {
                type: 'plain_text',
                text: 'Lead Name'
              }
            }
          ],
          submit: {
            type: 'plain_text',
            text: 'Create'
          }
        }
      });

    default:
      console.log('[Slack Shortcut] Unknown shortcut:', callback_id);
      return NextResponse.json({ status: 200 });
  }
}
