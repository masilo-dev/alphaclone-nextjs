import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { microsoftServerService } from '@/services/server/microsoftServerService';
import {
  getFacebookIntegrationWithToken,
  getFacebookIntegration,
} from '@/services/facebook/facebookIntegrationService';
import { getWhatsAppIntegrationWithToken } from '@/services/whatsapp/whatsappIntegrationService';
import { getInstagramIntegrationWithToken } from '@/services/instagram/instagramIntegrationService';
import { getLinkedInIntegrationWithToken } from '@/services/linkedin/linkedinIntegrationService';
import { getIntegrationEncryptionSecret } from '@/lib/integration/integrationTokenCrypto';

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
      name: 'Instagram',
      type: 'instagram',
      checkFunction: checkInstagramIntegration
    },
    {
      name: 'LinkedIn',
      type: 'linkedin',
      checkFunction: checkLinkedInIntegration
    },
    {
      name: 'WhatsApp',
      type: 'whatsapp',
      checkFunction: checkWhatsAppIntegration
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

async function checkFacebookIntegration(tenantId: string, supabase: any, userId: string) {
  const admin = createSupabaseAdminClient();
  const integration = await getFacebookIntegration(admin, { tenantId, requireActive: true });
  const withToken = integration
    ? await getFacebookIntegrationWithToken(admin, { tenantId, pageId: integration.page_id })
    : null;

  if (!integration || !withToken) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['Facebook integration not connected'],
      actions: ['Connect Facebook page'],
      connected: false
    };
  }

  const issues: string[] = [];
  const actions: string[] = [];
  let percentage = 0;
  const encryptionConfigured = Boolean(getIntegrationEncryptionSecret());

  if (integration.page_id) percentage += 25;
  else {
    issues.push('Page ID missing');
    actions.push('Reconnect Facebook to get Page ID');
  }

  if (withToken.pageAccessToken) percentage += 35;
  else {
    issues.push('Page access token missing or expired');
    actions.push('Reconnect Facebook to refresh page token');
  }

  if (integration.metadata && !(integration.metadata as { no_pages?: boolean }).no_pages) {
    percentage += 20;
  } else if ((integration.metadata as { no_pages?: boolean })?.no_pages) {
    issues.push('No Facebook Pages linked');
    actions.push('Grant pages_show_list and connect a Page');
  } else {
    percentage += 20;
  }

  if (encryptionConfigured) percentage += 20;
  else {
    issues.push('ENCRYPTION_SECRET not configured');
    actions.push('Set ENCRYPTION_SECRET (32 chars) in production');
  }

  if (withToken.pageAccessToken && percentage >= 80) {
    try {
      const testResponse = await fetch(
        `https://graph.facebook.com/v19.0/${integration.page_id}?fields=id,name&access_token=${encodeURIComponent(withToken.pageAccessToken)}`
      );
      if (!testResponse.ok) {
        issues.push('Facebook API access failed');
        actions.push('Reconnect Facebook page');
        percentage = Math.max(0, percentage - 35);
      } else {
        percentage = 100;
      }
    } catch {
      issues.push('Facebook API unreachable');
      actions.push('Check Facebook API permissions');
      percentage = Math.max(0, percentage - 35);
    }
  }

  void userId;
  return {
    status: percentage === 100 ? 'working' : 'needs_attention',
    percentage,
    issues,
    actions,
    connected: true,
    lastChecked: new Date().toISOString()
  };
}

async function checkInstagramIntegration(tenantId: string, _supabase: any, userId: string) {
  const admin = createSupabaseAdminClient();
  const integration = await getInstagramIntegrationWithToken(admin, { tenantId, userId });

  if (!integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['Instagram integration not connected'],
      actions: ['Connect Facebook to link Instagram Business account'],
      connected: false
    };
  }

  const issues: string[] = [];
  const actions: string[] = [];
  let percentage = 0;

  if (integration.instagram_account_id) percentage += 30;
  if (integration.username) percentage += 20;
  if (integration.pageAccessToken) percentage += 30;
  else {
    issues.push('Instagram page token missing');
    actions.push('Reconnect Facebook/Instagram');
  }
  if (getIntegrationEncryptionSecret()) percentage += 20;
  else {
    issues.push('ENCRYPTION_SECRET not configured');
    actions.push('Set ENCRYPTION_SECRET (32 chars)');
  }

  if (integration.pageAccessToken && percentage >= 80) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${integration.instagram_account_id}?fields=id,username&access_token=${encodeURIComponent(integration.pageAccessToken)}`
      );
      if (res.ok) percentage = 100;
      else {
        issues.push('Instagram API check failed');
        actions.push('Reconnect Instagram via Facebook OAuth');
        percentage = Math.max(0, percentage - 30);
      }
    } catch {
      issues.push('Instagram API unreachable');
      percentage = Math.max(0, percentage - 30);
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

async function checkLinkedInIntegration(tenantId: string, _supabase: any, userId: string) {
  const admin = createSupabaseAdminClient();
  const integration = await getLinkedInIntegrationWithToken(admin, { tenantId, userId });

  if (!integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['LinkedIn integration not connected'],
      actions: ['Connect LinkedIn account'],
      connected: false
    };
  }

  const issues: string[] = [];
  const actions: string[] = [];
  let percentage = 0;
  const scopes = Array.isArray(integration.scopes) ? integration.scopes : [];

  if (integration.linkedin_member_id) percentage += 25;
  if (integration.accessToken) percentage += 35;
  else {
    issues.push('LinkedIn access token missing');
    actions.push('Reconnect LinkedIn');
  }
  if (scopes.some((s) => ['w_member_social', 'w_organization_social'].includes(String(s)))) {
    percentage += 20;
  } else {
    issues.push('Publishing scopes not granted');
    actions.push('Reconnect LinkedIn with social publishing scopes');
  }
  if (getIntegrationEncryptionSecret()) percentage += 20;
  else {
    issues.push('ENCRYPTION_SECRET not configured');
    actions.push('Set ENCRYPTION_SECRET (32 chars)');
  }

  if (integration.accessToken && percentage >= 80) {
    try {
      const res = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${integration.accessToken}` },
      });
      if (res.ok) percentage = 100;
      else {
        issues.push('LinkedIn API check failed');
        actions.push('Reconnect LinkedIn');
        percentage = Math.max(0, percentage - 35);
      }
    } catch {
      issues.push('LinkedIn API unreachable');
      percentage = Math.max(0, percentage - 35);
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

async function checkWhatsAppIntegration(tenantId: string, _supabase: any) {
  const admin = createSupabaseAdminClient();
  const integration = await getWhatsAppIntegrationWithToken(admin, { tenantId });

  if (!integration) {
    return {
      status: 'not_connected',
      percentage: 0,
      issues: ['WhatsApp integration not connected'],
      actions: ['Add WhatsApp Business credentials under Integrations'],
      connected: false
    };
  }

  const issues: string[] = [];
  const actions: string[] = [];
  let percentage = 0;

  if (integration.waba_id) percentage += 20;
  if (integration.phone_number_id) percentage += 25;
  if (integration.accessToken) percentage += 25;
  else {
    issues.push('WhatsApp access token missing');
    actions.push('Reconnect WhatsApp credentials');
  }
  if (integration.webhook_verified) percentage += 10;
  else {
    issues.push('Webhook not verified with Meta');
    actions.push('Re-save WhatsApp integration to auto-subscribe webhook');
  }
  if (getIntegrationEncryptionSecret()) percentage += 20;
  else {
    issues.push('ENCRYPTION_SECRET not configured');
    actions.push('Set ENCRYPTION_SECRET (32 chars)');
  }

  if (integration.accessToken && percentage >= 70) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${integration.phone_number_id}?fields=id&access_token=${encodeURIComponent(integration.accessToken)}`
      );
      if (res.ok) percentage = 100;
      else {
        issues.push('WhatsApp API check failed');
        actions.push('Refresh Meta Cloud API token');
        percentage = Math.max(0, percentage - 25);
      }
    } catch {
      issues.push('WhatsApp API unreachable');
      percentage = Math.max(0, percentage - 25);
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

  if (hasRefreshToken) percentage += 30;
  else {
    issues.push('Refresh token missing');
    actions.push('Reconnect Zoho account');
  }

  if (hasMailHost) percentage += 25;
  else {
    issues.push('Mail API host missing');
    actions.push('Reconnect Zoho account');
  }

  if (hasAccountsServer) percentage += 25;
  else {
    issues.push('Accounts server missing');
    actions.push('Reconnect Zoho account');
  }

  if (getIntegrationEncryptionSecret()) percentage += 20;
  else {
    issues.push('ZOHO_ENCRYPTION_SECRET / ENCRYPTION_SECRET not configured');
    actions.push('Set encryption secret (32 chars)');
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
