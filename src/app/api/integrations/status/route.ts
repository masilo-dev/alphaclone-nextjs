import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { microsoftServerService } from '@/services/server/microsoftServerService';

export async function GET(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    
    // Set tenant context for RLS
    await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

    const integrationStatus = await checkAllIntegrations(tenantId, user.id, supabase);
    
    // Map integrations by type so UI components like data.sendgrid and data.resend work
    const mappedIntegrations = integrationStatus.reduce((acc, int) => ({
      ...acc,
      [int.type]: int
    }), {});

    return NextResponse.json({
      success: true,
      tenantId,
      overallStatus: calculateOverallStatus(integrationStatus),
      integrations: integrationStatus,
      ...mappedIntegrations,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Integration status check error:', error);
    return clientErrorResponse(error, { request: req, scope: 'integrations/status' });
  }
}

async function checkAllIntegrations(tenantId: string, userId: string, supabase: any) {
  const integrations = [
    {
      name: 'Slack',
      type: 'slack',
      checkFunction: checkSlackIntegration
    },
    {
      name: 'Facebook',
      type: 'facebook',
      checkFunction: checkFacebookIntegration
    },
    {
      name: 'Twilio',
      type: 'twilio',
      checkFunction: checkTwilioIntegration
    },
    {
      name: 'Google Calendar',
      type: 'google_calendar',
      checkFunction: checkGoogleCalendarIntegration
    },
    {
      name: 'Stripe',
      type: 'stripe',
      checkFunction: checkStripeIntegration
    },
    {
      name: 'HubSpot',
      type: 'hubspot',
      checkFunction: checkHubSpotIntegration
    },
    {
      name: 'SendGrid',
      type: 'sendgrid',
      checkFunction: checkSendGridIntegration
    },
    {
      name: 'Resend',
      type: 'resend',
      checkFunction: checkResendIntegration
    },
    {
      name: 'Brevo',
      type: 'brevo',
      checkFunction: checkBrevoIntegration
    },
    {
      name: 'Zoho',
      type: 'zoho',
      checkFunction: checkZohoIntegration
    },
    {
      name: 'Microsoft 365',
      type: 'microsoft',
      checkFunction: checkMicrosoftIntegration
    }
  ];

  const results = [];

  for (const integration of integrations) {
    try {
      const status = await integration.checkFunction(tenantId, supabase, userId);
      results.push({
        name: integration.name,
        type: integration.type,
        ...status
      });
    } catch (error: unknown) {
      console.error('[integrations/status]', integration.type, error);
      results.push({
        name: integration.name,
        type: integration.type,
        status: 'error',
        percentage: 0,
        issues: ['Status check failed'],
        actions: [],
        connected: false
      });
    }
  }

  return results;
}

async function checkSlackIntegration(tenantId: string, supabase: any) {
  const { data: integration, error } = await supabase
    .from('slack_integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single();

  if (error || !integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['Slack integration not connected'],
      actions: ['Connect Slack workspace'],
      connected: false
    };
  }

  const issues = [];
  const actions = [];
  let percentage = 0;

  // Check required fields
  if (!integration.team_id) {
    issues.push('Team ID missing');
    actions.push('Reconnect Slack to get Team ID');
  } else {
    percentage += 25;
  }

  if (!integration.bot_access_token) {
    issues.push('Bot access token missing');
    actions.push('Reconnect Slack to get bot access token');
  } else {
    percentage += 25;
  }

  if (!integration.webhook_url) {
    issues.push('Webhook URL missing');
    actions.push('Configure webhook URL');
  } else {
    percentage += 25;
  }

  if (!integration.default_channel) {
    issues.push('Default channel not set');
    actions.push('Set default channel');
  } else {
    percentage += 25;
  }

  // Test webhook if available
  if (integration.webhook_url && percentage === 100) {
    try {
      const testResponse = await fetch(integration.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '🔍 Integration Status Check',
          blocks: [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*🔍 Slack Integration Status Check*\n\nYour Slack integration is working correctly!'
            }
          }]
        })
      });

      if (!testResponse.ok) {
        issues.push('Webhook test failed');
        actions.push('Check webhook URL permissions');
        percentage -= 25;
      }
    } catch (error) {
      issues.push('Webhook unreachable');
      actions.push('Verify webhook URL');
      percentage -= 25;
    }
  }

  return {
    status: percentage === 100 ? 'working' : 'needs_attention',
    percentage,
    issues,
    actions,
    connected: true,
    lastChecked: new Date().toISOString()
  };
}

async function checkFacebookIntegration(tenantId: string, supabase: any) {
  const { data: integration, error } = await supabase
    .from('facebook_integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single();

  if (error || !integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['Facebook integration not connected'],
      actions: ['Connect Facebook page'],
      connected: false
    };
  }

  const issues = [];
  const actions = [];
  let percentage = 0;

  // Check required fields
  if (!integration.page_id) {
    issues.push('Page ID missing');
    actions.push('Reconnect Facebook to get Page ID');
  } else {
    percentage += 33;
  }

  if (!integration.page_access_token) {
    issues.push('Page access token missing');
    actions.push('Reconnect Facebook to get page access token');
  } else {
    percentage += 33;
  }

  if (!integration.user_access_token) {
    issues.push('User access token missing');
    actions.push('Reconnect Facebook to get user access token');
  } else {
    percentage += 34;
  }

  // Test API access if tokens are available
  if (integration.page_access_token && percentage === 100) {
    try {
      const testResponse = await fetch(
        `https://graph.facebook.com/v18.0/${integration.page_id}?access_token=${integration.page_access_token}&fields=id,name`
      );

      if (!testResponse.ok) {
        issues.push('Facebook API access failed');
        actions.push('Reconnect Facebook page');
        percentage -= 34;
      }
    } catch (error) {
      issues.push('Facebook API unreachable');
      actions.push('Check Facebook API permissions');
      percentage -= 34;
    }
  }

  return {
    status: percentage === 100 ? 'working' : 'needs_attention',
    percentage,
    issues,
    actions,
    connected: true,
    lastChecked: new Date().toISOString()
  };
}

async function checkTwilioIntegration(tenantId: string, supabase: any) {
  const { data: integration, error } = await supabase
    .from('twilio_integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single();

  if (error || !integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['Twilio integration not connected'],
      actions: ['Connect Twilio account'],
      connected: false
    };
  }

  const issues = [];
  const actions = [];
  let percentage = 0;

  // Check required fields
  if (!integration.account_sid) {
    issues.push('Account SID missing');
    actions.push('Reconnect Twilio to get Account SID');
  } else {
    percentage += 33;
  }

  if (!integration.auth_token) {
    issues.push('Auth token missing');
    actions.push('Reconnect Twilio to get Auth token');
  } else {
    percentage += 33;
  }

  if (!integration.phone_number) {
    issues.push('Phone number missing');
    actions.push('Set up Twilio phone number');
  } else {
    percentage += 34;
  }

  // Test API access if credentials are available
  if (integration.account_sid && integration.auth_token && percentage === 100) {
    try {
      const encodedCredentials = Buffer.from(`${integration.account_sid}:${integration.auth_token}`).toString('base64');
      
      const testResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${integration.account_sid}.json`,
        {
          headers: {
            'Authorization': `Basic ${encodedCredentials}`
          }
        }
      );

      if (!testResponse.ok) {
        issues.push('Twilio API access failed');
        actions.push('Check Twilio credentials');
        percentage -= 34;
      }
    } catch (error) {
      issues.push('Twilio API unreachable');
      actions.push('Check Twilio API permissions');
      percentage -= 34;
    }
  }

  return {
    status: percentage === 100 ? 'working' : 'needs_attention',
    percentage,
    issues,
    actions,
    connected: true,
    lastChecked: new Date().toISOString()
  };
}

async function checkGoogleCalendarIntegration(tenantId: string, supabase: any) {
  const { data: integration, error } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single();

  if (error || !integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['Google Calendar integration not connected'],
      actions: ['Connect Google Calendar'],
      connected: false
    };
  }

  const issues = [];
  const actions = [];
  let percentage = 0;

  // Check required fields
  if (!integration.access_token) {
    issues.push('Access token missing');
    actions.push('Reconnect Google Calendar');
  } else {
    percentage += 50;
  }

  if (!integration.refresh_token) {
    issues.push('Refresh token missing');
    actions.push('Reconnect Google Calendar with refresh token');
  } else {
    percentage += 50;
  }

  // Test API access if token is available
  if (integration.access_token && percentage === 100) {
    try {
      const testResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary?access_token=' + integration.access_token
      );

      if (!testResponse.ok) {
        issues.push('Google Calendar API access failed');
        actions.push('Reconnect Google Calendar');
        percentage -= 50;
      }
    } catch (error) {
      issues.push('Google Calendar API unreachable');
      actions.push('Check Google Calendar API permissions');
      percentage -= 50;
    }
  }

  return {
    status: percentage === 100 ? 'working' : 'needs_attention',
    percentage,
    issues,
    actions,
    connected: true,
    lastChecked: new Date().toISOString()
  };
}

async function checkStripeIntegration(tenantId: string, supabase: any) {
  const { data: integration, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('type', 'stripe')
    .eq('enabled', true)
    .single();

  if (error || !integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['Stripe integration not connected'],
      actions: ['Connect Stripe account'],
      connected: false
    };
  }

  const issues = [];
  const actions = [];
  let percentage = 0;

  const config = integration.config || {};

  // Check required fields
  if (!config.account_id) {
    issues.push('Account ID missing');
    actions.push('Reconnect Stripe to get Account ID');
  } else {
    percentage += 33;
  }

  if (!config.publishable_key) {
    issues.push('Publishable key missing');
    actions.push('Reconnect Stripe to get publishable key');
  } else {
    percentage += 33;
  }

  if (!config.secret_key) {
    issues.push('Secret key missing');
    actions.push('Reconnect Stripe to get secret key');
  } else {
    percentage += 34;
  }

  return {
    status: percentage === 100 ? 'working' : 'needs_attention',
    percentage,
    issues,
    actions,
    connected: true,
    lastChecked: new Date().toISOString()
  };
}

async function checkHubSpotIntegration(tenantId: string, supabase: any) {
  const { data: integration, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('type', 'hubspot')
    .eq('enabled', true)
    .single();

  if (error || !integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['HubSpot integration not connected'],
      actions: ['Connect HubSpot account'],
      connected: false
    };
  }

  const issues = [];
  const actions = [];
  let percentage = 0;

  const config = integration.config || {};

  // Check required fields
  if (!config.access_token) {
    issues.push('Access token missing');
    actions.push('Reconnect HubSpot to get access token');
  } else {
    percentage += 50;
  }

  if (!config.portal_id) {
    issues.push('Portal ID missing');
    actions.push('Reconnect HubSpot to get Portal ID');
  } else {
    percentage += 50;
  }

  // Test API access if token is available
  if (config.access_token && percentage === 100) {
    try {
      const testResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=1',
        {
          headers: {
            'Authorization': `Bearer ${config.access_token}`
          }
        }
      );

      if (!testResponse.ok) {
        issues.push('HubSpot API access failed');
        actions.push('Reconnect HubSpot');
        percentage -= 50;
      }
    } catch (error) {
      issues.push('HubSpot API unreachable');
      actions.push('Check HubSpot API permissions');
      percentage -= 50;
    }
  }

  return {
    status: percentage === 100 ? 'working' : 'needs_attention',
    percentage,
    issues,
    actions,
    connected: true,
    lastChecked: new Date().toISOString()
  };
}

async function checkSendGridIntegration(tenantId: string, supabase: any) {
  const { data: integration, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('type', 'sendgrid')
    .eq('enabled', true)
    .single();

  if (error || !integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['SendGrid integration not connected'],
      actions: ['Connect SendGrid account'],
      connected: false
    };
  }

  const issues = [];
  const actions = [];
  let percentage = 0;

  const config = integration.config || {};

  // Check required fields
  if (!config.api_key) {
    issues.push('API key missing');
    actions.push('Reconnect SendGrid to get API key');
  } else {
    percentage += 40;
  }

  if (!config.from_email) {
    issues.push('From email missing');
    actions.push('Set from email address');
  } else {
    percentage += 30;
  }

  if (!config.from_name) {
    issues.push('From name missing');
    actions.push('Set from name');
  } else {
    percentage += 30;
  }

  return {
    status: percentage === 100 ? 'working' : 'needs_attention',
    percentage,
    issues,
    actions,
    connected: true,
    lastChecked: new Date().toISOString()
  };
}

async function checkResendIntegration(tenantId: string, supabase: any) {
  // Support both storage models used across the app.
  const { data: tenantIntegration } = await supabase
    .from('tenant_integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'resend')
    .eq('status', 'active')
    .maybeSingle();

  const { data: userIntegration } = await supabase
    .from('integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('type', 'resend')
    .eq('enabled', true)
    .maybeSingle();

  const integration = tenantIntegration || userIntegration;

  if (!integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['Resend integration not connected'],
      actions: ['Connect Resend account'],
      connected: false
    };
  }

  const issues = [];
  const actions = [];
  let percentage = 0;

  // Check required fields
  const config = integration.config || {};
  const apiKey = integration.access_token || config.api_key || config.apiKey;
  const domain = integration.domain || config.domain;

  if (!apiKey) {
    issues.push('API key missing');
    actions.push('Reconnect Resend to get API key');
  } else {
    percentage += 50;
  }

  if (!domain) {
    issues.push('Domain missing');
    actions.push('Set domain');
  } else {
    percentage += 50;
  }

  return {
    status: percentage === 100 ? 'working' : 'needs_attention',
    percentage,
    issues,
    actions,
    domain: domain || undefined,
    updated_at: integration.updated_at,
    connected: true,
    lastChecked: new Date().toISOString()
  };
}

async function checkBrevoIntegration(tenantId: string, supabase: any) {
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('type', 'brevo')
    .eq('enabled', true)
    .maybeSingle();

  if (!integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['Brevo integration not connected'],
      actions: ['Connect Brevo account'],
      connected: false
    };
  }

  const issues = [];
  const actions = [];
  let percentage = 0;
  const config = integration.config || {};

  if (!config.api_key && !config.apiKey) {
    issues.push('API key missing');
    actions.push('Reconnect Brevo to get API key');
  } else {
    percentage += 50;
  }

  if (!config.from_email && !config.fromEmail) {
    issues.push('From email missing');
    actions.push('Set default from email');
  } else {
    percentage += 50;
  }

  return {
    status: percentage === 100 ? 'working' : 'needs_attention',
    percentage,
    issues,
    actions,
    connected: true,
    lastChecked: new Date().toISOString()
  };
}

async function checkZohoIntegration(_tenantId: string, supabase: any, userId: string) {
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'zoho')
    .eq('enabled', true)
    .maybeSingle();

  if (!integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['Zoho integration not connected'],
      actions: ['Connect Zoho account'],
      connected: false
    };
  }

  const config = integration.config || {};
  const hasRefreshToken = Boolean(config.refreshToken);
  const hasMailHost = Boolean(config.mailApiHost);
  const hasAccountsServer = Boolean(config.accountsServer);
  const issues = [];
  const actions = [];
  let percentage = 0;

  if (hasRefreshToken) percentage += 40;
  else {
    issues.push('Refresh token missing');
    actions.push('Reconnect Zoho account');
  }

  if (hasMailHost) percentage += 30;
  else {
    issues.push('Mail API host missing');
    actions.push('Reconnect Zoho account');
  }

  if (hasAccountsServer) percentage += 30;
  else {
    issues.push('Accounts server missing');
    actions.push('Reconnect Zoho account');
  }

  return {
    status: percentage === 100 ? 'working' : 'needs_attention',
    percentage,
    issues,
    actions,
    connected: true,
    lastChecked: new Date().toISOString()
  };
}

async function checkMicrosoftIntegration(_tenantId: string, supabase: any, userId: string) {
  const { data: connection, error } = await supabase
    .from('microsoft_connections')
    .select('microsoft_email, display_name, token_expiry')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !connection) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['Microsoft 365 is not connected'],
      actions: ['Connect Microsoft 365'],
      connected: false,
    };
  }

  const issues = [];
  const actions = [];
  let percentage = 60;

  if (connection.microsoft_email) percentage += 20;
  else {
    issues.push('Microsoft email missing');
    actions.push('Reconnect Microsoft 365');
  }

  if (connection.token_expiry && new Date(connection.token_expiry).getTime() > Date.now()) {
    percentage += 20;
  } else {
    try {
      await microsoftServerService.getConnection(userId);
      percentage += 20;
    } catch {
      issues.push('Microsoft token refresh required');
      actions.push('Reconnect Microsoft 365');
    }
  }

  return {
    status: percentage === 100 ? 'working' : 'needs_attention',
    percentage,
    issues,
    actions,
    connected: true,
    email: connection.microsoft_email,
    displayName: connection.display_name,
    lastChecked: new Date().toISOString(),
  };
}

function calculateOverallStatus(integrations: any[]) {
  const totalIntegrations = integrations.length;
  const workingIntegrations = integrations.filter(i => i.status === 'working').length;
  const connectedIntegrations = integrations.filter(i => i.connected).length;
  const averagePercentage = integrations.reduce((sum, i) => sum + i.percentage, 0) / totalIntegrations;

  return {
    totalIntegrations,
    workingIntegrations,
    connectedIntegrations,
    averagePercentage: Math.round(averagePercentage),
    status: averagePercentage === 100 ? 'excellent' : averagePercentage >= 80 ? 'good' : averagePercentage >= 60 ? 'fair' : 'needs_attention'
  };
}
