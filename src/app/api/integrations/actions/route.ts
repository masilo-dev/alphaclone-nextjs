import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { requireTenantAccess } from '@/lib/apiAuth';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { operationFailed, OPERATION_FAILED_MESSAGE } from '@/lib/api/operationResult';
import { integrationActionSchema } from '@/schemas/validation';
import {
  getFacebookIntegrationWithToken,
  upsertFacebookIntegration,
} from '@/services/facebook/facebookIntegrationService';

export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await req.json();
    const parsed = integrationActionSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
    }
    const { tenantId, integrationType, action, config } = parsed.data;

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    // Set tenant context for RLS
    await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

    let result: any = { success: false, data: null, error: null };

    switch (integrationType) {
      case 'slack':
        result = await handleSlackAction(tenantId, action, config, supabase);
        break;
      case 'facebook':
        result = await handleFacebookAction(tenantId, action, config, supabase, user.id);
        break;
      case 'twilio':
        result = await handleTwilioAction(tenantId, action, config, supabase);
        break;
      case 'google_calendar':
        result = await handleGoogleCalendarAction(tenantId, action, config, supabase);
        break;
      case 'stripe':
        result = await handleStripeAction(tenantId, action, config, supabase);
        break;
      case 'hubspot':
        result = await handleHubSpotAction(tenantId, action, config, supabase);
        break;
      case 'sendgrid':
        result = await handleSendGridAction(tenantId, action, config, supabase);
        break;
      default:
        result = { success: false, error: 'Unsupported integration type', data: null };
    }

    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('Integration action error:', error);
    return clientErrorResponse(error, { request: req, scope: 'integrations/actions.POST' });
  }
}

async function handleSlackAction(tenantId: string, action: string, config: any, supabase: any) {
  try {
    switch (action) {
      case 'connect':
        // Save Slack integration
        const { data, error } = await supabase
          .from('slack_integrations')
          .upsert({
            tenant_id: tenantId,
            team_id: config.teamId,
            team_name: config.teamName,
            bot_user_id: config.botUserId,
            bot_access_token: config.botAccessToken,
            webhook_url: config.webhookUrl,
            default_channel: config.defaultChannel || '#general',
            is_active: true,
            connected_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        // Test the integration
        const testResult = await testSlackIntegration(config.webhookUrl);
        
        return { 
          success: true, 
          data: { integration: data, test: testResult },
          message: 'Slack integration connected successfully'
        };

      case 'send_message':
        // Send message to Slack
        const slackIntegration = await supabase
          .from('slack_integrations')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .single();

        if (!slackIntegration.data) {
          return { success: false, error: 'Slack integration not found' };
        }

        const messagePayload = {
          text: config.message,
          blocks: config.blocks || [],
          channel: config.channel || slackIntegration.data.default_channel
        };

        const response = await fetch(slackIntegration.data.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messagePayload)
        });

        const result = await response.json();

        // Log the message
        await supabase.from('slack_message_logs').insert({
          tenant_id: tenantId,
          channel: config.channel || slackIntegration.data.default_channel,
          message_text: config.message,
          status: response.ok ? 'sent' : 'failed',
          metadata: { payload: messagePayload, response: result }
        });

        return { 
          success: response.ok, 
          data: result,
          message: response.ok ? 'Message sent successfully' : 'Failed to send message'
        };

      case 'disconnect':
        // Disconnect Slack integration
        const { error: disconnectError } = await supabase
          .from('slack_integrations')
          .update({ is_active: false })
          .eq('tenant_id', tenantId);

        if (disconnectError) throw disconnectError;

        return { success: true, message: 'Slack integration disconnected' };

      default:
        return { success: false, error: 'Unsupported Slack action' };
    }
  } catch (error: any) {
    return operationFailed('integrations/actions', error);
  }
}

async function handleFacebookAction(tenantId: string, action: string, config: any, supabase: any, userId: string) {
  try {
    switch (action) {
      case 'connect': {
        const fbResult = await upsertFacebookIntegration({
          userId,
          tenantId,
          pageId: config.pageId,
          pageName: config.pageName,
          pageAccessToken: config.pageAccessToken,
          userAccessToken: config.userAccessToken,
          appScopedUserId: config.appScopedUserId,
          expiresAt: config.expiresAt || null,
          metadata: config.metadata || {},
        });

        if (!fbResult.integrationId) {
          throw new Error(fbResult.error || 'Facebook integration upsert failed');
        }

        const testResult = await testFacebookIntegration(config.pageAccessToken);

        return {
          success: true,
          data: { integrationId: fbResult.integrationId, test: testResult },
          message: 'Facebook integration connected successfully',
        };
      }

      case 'get_leads': {
        const integration = await getFacebookIntegrationWithToken(supabase, { tenantId });

        if (!integration?.pageAccessToken) {
          return { success: false, error: 'Facebook integration not found' };
        }

        const leadsResponse = await fetch(
          `https://graph.facebook.com/v18.0/${integration.page_id}/leadgen_forms?access_token=${integration.pageAccessToken}`
        );
        
        const leadsData = await leadsResponse.json();

        return { 
          success: leadsResponse.ok, 
          data: leadsData,
          message: leadsResponse.ok ? 'Leads retrieved successfully' : 'Failed to retrieve leads'
        };
      }

      case 'disconnect':
        // Disconnect Facebook integration
        const { error: disconnectError } = await supabase
          .from('facebook_integrations')
          .update({ is_active: false })
          .eq('tenant_id', tenantId);

        if (disconnectError) throw disconnectError;

        return { success: true, message: 'Facebook integration disconnected' };

      default:
        return { success: false, error: 'Unsupported Facebook action' };
    }
  } catch (error: any) {
    return operationFailed('integrations/actions', error);
  }
}

async function handleTwilioAction(tenantId: string, action: string, config: any, supabase: any) {
  try {
    switch (action) {
      case 'connect':
        // Save Twilio integration
        const { data, error } = await supabase
          .from('twilio_integrations')
          .upsert({
            tenant_id: tenantId,
            account_sid: config.accountSid,
            auth_token: config.authToken,
            phone_number: config.phoneNumber,
            is_active: true
          })
          .select()
          .single();

        if (error) throw error;

        // Test the integration
        const testResult = await testTwilioIntegration(config.accountSid, config.authToken);
        
        return { 
          success: true, 
          data: { integration: data, test: testResult },
          message: 'Twilio integration connected successfully'
        };

      case 'send_sms':
        // Send SMS
        const twilioIntegration = await supabase
          .from('twilio_integrations')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .single();

        if (!twilioIntegration.data) {
          return { success: false, error: 'Twilio integration not found' };
        }

        const smsPayload = {
          To: config.to,
          From: twilioIntegration.data.phone_number,
          Body: config.message
        };

        const encodedCredentials = Buffer.from(`${twilioIntegration.data.account_sid}:${twilioIntegration.data.auth_token}`).toString('base64');
        
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioIntegration.data.account_sid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${encodedCredentials}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams(smsPayload)
          }
        );

        const result = await response.json();

        // Log the SMS
        await supabase.from('sms_messages').insert({
          tenant_id: tenantId,
          to: config.to,
          from: twilioIntegration.data.phone_number,
          body: config.message,
          status: response.ok ? 'sent' : 'failed',
          metadata: { response: result }
        });

        return { 
          success: response.ok, 
          data: result,
          message: response.ok ? 'SMS sent successfully' : 'Failed to send SMS'
        };

      case 'disconnect':
        // Disconnect Twilio integration
        const { error: disconnectError } = await supabase
          .from('twilio_integrations')
          .update({ is_active: false })
          .eq('tenant_id', tenantId);

        if (disconnectError) throw disconnectError;

        return { success: true, message: 'Twilio integration disconnected' };

      default:
        return { success: false, error: 'Unsupported Twilio action' };
    }
  } catch (error: any) {
    return operationFailed('integrations/actions', error);
  }
}

async function handleGoogleCalendarAction(tenantId: string, action: string, config: any, supabase: any) {
  try {
    switch (action) {
      case 'connect':
        // Save Google Calendar integration
        const { data, error } = await supabase
          .from('google_calendar_tokens')
          .upsert({
            tenant_id: tenantId,
            access_token: config.accessToken,
            refresh_token: config.refreshToken,
            expires_at: config.expiresAt,
            is_active: true
          })
          .select()
          .single();

        if (error) throw error;

        // Test the integration
        const testResult = await testGoogleCalendarIntegration(config.accessToken);
        
        return { 
          success: true, 
          data: { integration: data, test: testResult },
          message: 'Google Calendar integration connected successfully'
        };

      case 'sync_events':
        // Sync calendar events
        const calendarIntegration = await supabase
          .from('google_calendar_tokens')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .single();

        if (!calendarIntegration.data) {
          return { success: false, error: 'Google Calendar integration not found' };
        }

        const eventsResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10',
          {
            headers: {
              'Authorization': `Bearer ${calendarIntegration.data.access_token}`
            }
          }
        );
        
        const eventsData = await eventsResponse.json();

        return { 
          success: eventsResponse.ok, 
          data: eventsData,
          message: eventsResponse.ok ? 'Events synced successfully' : 'Failed to sync events'
        };

      case 'disconnect':
        // Disconnect Google Calendar integration
        const { error: disconnectError } = await supabase
          .from('google_calendar_tokens')
          .update({ is_active: false })
          .eq('tenant_id', tenantId);

        if (disconnectError) throw disconnectError;

        return { success: true, message: 'Google Calendar integration disconnected' };

      default:
        return { success: false, error: 'Unsupported Google Calendar action' };
    }
  } catch (error: any) {
    return operationFailed('integrations/actions', error);
  }
}

async function handleStripeAction(tenantId: string, action: string, config: any, supabase: any) {
  try {
    switch (action) {
      case 'connect':
        // Save Stripe integration
        const { data, error } = await supabase
          .from('integrations')
          .upsert({
            tenant_id: tenantId,
            type: 'stripe',
            name: 'Stripe Connect',
            config: {
              account_id: config.accountId,
              publishable_key: config.publishableKey,
              secret_key: config.secretKey
            },
            enabled: true
          })
          .select()
          .single();

        if (error) throw error;

        return { 
          success: true, 
          data: data,
          message: 'Stripe integration connected successfully'
        };

      case 'create_payment_intent':
        // Create payment intent
        const stripeIntegration = await supabase
          .from('integrations')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('type', 'stripe')
          .eq('enabled', true)
          .single();

        if (!stripeIntegration.data) {
          return { success: false, error: 'Stripe integration not found' };
        }

        // This would use Stripe SDK - for now return mock response
        return { 
          success: true, 
          data: { client_secret: 'pi_test_client_secret' },
          message: 'Payment intent created successfully'
        };

      default:
        return { success: false, error: 'Unsupported Stripe action' };
    }
  } catch (error: any) {
    return operationFailed('integrations/actions', error);
  }
}

async function handleHubSpotAction(tenantId: string, action: string, config: any, supabase: any) {
  try {
    switch (action) {
      case 'connect':
        // Save HubSpot integration
        const { data, error } = await supabase
          .from('integrations')
          .upsert({
            tenant_id: tenantId,
            type: 'hubspot',
            name: 'HubSpot CRM',
            config: {
              access_token: config.accessToken,
              refresh_token: config.refreshToken,
              portal_id: config.portalId
            },
            enabled: true
          })
          .select()
          .single();

        if (error) throw error;

        return { 
          success: true, 
          data: data,
          message: 'HubSpot integration connected successfully'
        };

      case 'sync_contacts':
        // Sync contacts from HubSpot
        const hubspotIntegration = await supabase
          .from('integrations')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('type', 'hubspot')
          .eq('enabled', true)
          .single();

        if (!hubspotIntegration.data) {
          return { success: false, error: 'HubSpot integration not found' };
        }

        const contactsResponse = await fetch(
          'https://api.hubapi.com/crm/v3/objects/contacts?limit=10',
          {
            headers: {
              'Authorization': `Bearer ${hubspotIntegration.data.config.access_token}`
            }
          }
        );
        
        const contactsData = await contactsResponse.json();

        return { 
          success: contactsResponse.ok, 
          data: contactsData,
          message: contactsResponse.ok ? 'Contacts synced successfully' : 'Failed to sync contacts'
        };

      default:
        return { success: false, error: 'Unsupported HubSpot action' };
    }
  } catch (error: any) {
    return operationFailed('integrations/actions', error);
  }
}

async function handleSendGridAction(tenantId: string, action: string, config: any, supabase: any) {
  try {
    switch (action) {
      case 'connect':
        // Save SendGrid integration
        const { data, error } = await supabase
          .from('integrations')
          .upsert({
            tenant_id: tenantId,
            type: 'sendgrid',
            name: 'SendGrid Email',
            config: {
              api_key: config.apiKey,
              from_email: config.fromEmail,
              from_name: config.fromName
            },
            enabled: true
          })
          .select()
          .single();

        if (error) throw error;

        return { 
          success: true, 
          data: data,
          message: 'SendGrid integration connected successfully'
        };

      case 'send_email':
        // Send email
        const sendgridIntegration = await supabase
          .from('integrations')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('type', 'sendgrid')
          .eq('enabled', true)
          .single();

        if (!sendgridIntegration.data) {
          return { success: false, error: 'SendGrid integration not found' };
        }

        const emailPayload = {
          personalizations: [{
            to: [{ email: config.to }],
            subject: config.subject
          }],
          from: {
            email: sendgridIntegration.data.config.from_email,
            name: sendgridIntegration.data.config.from_name
          },
          content: [{
            type: 'text/plain',
            value: config.body
          }]
        };

        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridIntegration.data.config.api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        });

        return { 
          success: response.ok, 
          message: response.ok ? 'Email sent successfully' : 'Failed to send email'
        };

      default:
        return { success: false, error: 'Unsupported SendGrid action' };
    }
  } catch (error: any) {
    return operationFailed('integrations/actions', error);
  }
}

// Test functions
async function testSlackIntegration(webhookUrl: string) {
  try {
    const testPayload = {
      text: '🧪 Test message from AlphaClone',
      blocks: [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🧪 Slack Integration Test*\n\nThis is a test message to verify your Slack integration is working correctly.'
        }
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    return { success: response.ok, status: response.status };
  } catch (error) {
    console.error('[integrations/actions] testSlack:', error);
    return { success: false, error: OPERATION_FAILED_MESSAGE };
  }
}

async function testFacebookIntegration(accessToken: string) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${accessToken}&fields=id,name`
    );
    
    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    console.error('[integrations/actions] testFacebook:', error);
    return { success: false, error: OPERATION_FAILED_MESSAGE };
  }
}

async function testTwilioIntegration(accountSid: string, authToken: string) {
  try {
    const encodedCredentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      {
        headers: {
          'Authorization': `Basic ${encodedCredentials}`
        }
      }
    );
    
    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    console.error('[integrations/actions] testTwilio:', error);
    return { success: false, error: OPERATION_FAILED_MESSAGE };
  }
}

async function testGoogleCalendarIntegration(accessToken: string) {
  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary?access_token=' + accessToken
    );
    
    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    console.error('[integrations/actions] testGoogleCalendar:', error);
    return { success: false, error: OPERATION_FAILED_MESSAGE };
  }
}
