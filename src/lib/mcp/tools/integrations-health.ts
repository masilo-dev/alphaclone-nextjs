import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  CORE_INTEGRATIONS_FOR_HEALTH,
  hasBookingIntegration,
  normalizeIntegrationType,
  OPTIONAL_INTEGRATIONS_FOR_HEALTH,
} from '@/lib/mcp/integrationHealthPolicy';

type IntegrationHealth = {
  name: string;
  key: string;
  status: 'connected' | 'configured' | 'missing' | 'error';
  connected: boolean;
  details: Record<string, unknown>;
};

function envPresent(...keys: string[]) {
  return keys.some((k) => Boolean(process.env[k] && String(process.env[k]).trim()));
}

async function tenantHasIntegration(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  types: string[]
) {
  const { data, error } = await supabase
    .from('integrations')
    .select('id, type, enabled, updated_at')
    .eq('tenant_id', tenantId)
    .in('type', types)
    .limit(5);
  if (error) return { rows: [], error: error.message };
  return { rows: data || [], error: null };
}

defineConnectorTool({
  module: 'integrations-health',
  name: 'github_health',
  description: 'Health/status for GitHub integration.',
  permission: 'integrations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { rows, error } = await tenantHasIntegration(supabase, args.tenant_id, ['github']);
    const configured = envPresent('GITHUB_TOKEN', 'GITHUB_APP_ID');
    const connected = rows.some((r: any) => r.enabled !== false) || configured;
    const result: IntegrationHealth = {
      name: 'GitHub',
      key: 'github',
      status: connected ? (rows.length ? 'connected' : 'configured') : 'missing',
      connected,
      details: { tenant_rows: rows.length, env_configured: configured, error, optional: true },
    };
    return result;
  },
});

defineConnectorTool({
  module: 'integrations-health',
  name: 'gmail_health',
  description: 'Health/status for Gmail integration.',
  permission: 'integrations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { rows } = await tenantHasIntegration(supabase, args.tenant_id, ['gmail', 'google_gmail']);
    const { data: gmail } = await supabase
      .from('gmail_integrations')
      .select('id, email, is_active, updated_at')
      .eq('tenant_id', args.tenant_id)
      .eq('is_active', true)
      .limit(5);
    const connected = (gmail || []).length > 0 || rows.length > 0;
    return {
      name: 'Gmail',
      key: 'gmail',
      status: connected ? 'connected' : 'missing',
      connected,
      details: { accounts: gmail || [], integration_rows: rows.length, optional: true },
    } satisfies IntegrationHealth;
  },
});

defineConnectorTool({
  module: 'integrations-health',
  name: 'google_calendar_health',
  description: 'Health/status for Google Calendar integration.',
  permission: 'integrations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { rows } = await tenantHasIntegration(supabase, args.tenant_id, [
      'google_calendar',
      'google-calendar',
    ]);
    return {
      name: 'Google Calendar',
      key: 'google_calendar',
      status: rows.length ? 'connected' : 'missing',
      connected: rows.length > 0,
      details: { integration_rows: rows },
    } satisfies IntegrationHealth;
  },
});

defineConnectorTool({
  module: 'integrations-health',
  name: 'zoho_health',
  description: 'Health/status for Zoho integration.',
  permission: 'integrations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { rows } = await tenantHasIntegration(supabase, args.tenant_id, ['zoho', 'zoho_mail']);
    return {
      name: 'Zoho',
      key: 'zoho',
      status: rows.length ? 'connected' : 'missing',
      connected: rows.length > 0,
      details: { integration_rows: rows },
    } satisfies IntegrationHealth;
  },
});

defineConnectorTool({
  module: 'integrations-health',
  name: 'stripe_health',
  description: 'Health/status for Stripe payments integration.',
  permission: 'integrations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { rows } = await tenantHasIntegration(supabase, args.tenant_id, ['stripe']);
    const configured = envPresent('STRIPE_SECRET_KEY');
    const connected = configured || rows.length > 0;
    return {
      name: 'Stripe',
      key: 'stripe',
      status: connected ? (rows.length ? 'connected' : 'configured') : 'missing',
      connected,
      details: {
        env_configured: configured,
        has_webhook_secret: envPresent('STRIPE_WEBHOOK_SECRET'),
        integration_rows: rows.length,
      },
    } satisfies IntegrationHealth;
  },
});

defineConnectorTool({
  module: 'integrations-health',
  name: 'calcom_health',
  description: 'Health/status for Cal.com booking integration (optional — does not reduce platform health score).',
  permission: 'integrations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { rows } = await tenantHasIntegration(supabase, args.tenant_id, ['calcom', 'cal.com']);
    const configured = envPresent('CAL_OAUTH_CLIENT_ID', 'CAL_OAUTH_CLIENT_SECRET');
    const connected = rows.some((r: { enabled?: boolean | null }) => r.enabled !== false) || configured;
    return {
      name: 'Cal.com',
      key: 'calcom',
      optional: true,
      status: connected ? (rows.length ? 'connected' : 'configured') : 'missing',
      connected,
      details: { integration_rows: rows.length, env_configured: configured },
    } satisfies IntegrationHealth & { optional: boolean };
  },
});

defineConnectorTool({
  module: 'integrations-health',
  name: 'calendly_health',
  description: 'Health/status for Calendly integration.',
  permission: 'integrations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { rows } = await tenantHasIntegration(supabase, args.tenant_id, ['calendly']);
    return {
      name: 'Calendly',
      key: 'calendly',
      optional: true,
      status: rows.length ? 'connected' : 'missing',
      connected: rows.length > 0,
      details: { integration_rows: rows },
    } satisfies IntegrationHealth & { optional: boolean };
  },
});

defineConnectorTool({
  module: 'integrations-health',
  name: 'railway_health',
  description: 'Health/status for Railway deployment integration / environment.',
  permission: 'integrations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async () => {
    const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
    const tokenConfigured = envPresent('RAILWAY_TOKEN', 'RAILWAY_API_TOKEN');
    return {
      name: 'Railway',
      key: 'railway',
      status: onRailway || tokenConfigured ? 'configured' : 'missing',
      connected: onRailway || tokenConfigured,
      details: {
        on_railway: onRailway,
        environment: process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT || null,
        project_id: process.env.RAILWAY_PROJECT_ID || null,
        service_id: process.env.RAILWAY_SERVICE_ID || null,
        token_configured: tokenConfigured,
      },
    } satisfies IntegrationHealth;
  },
});

defineConnectorTool({
  module: 'integrations-health',
  name: 'supabase_health',
  description: 'Health/status for Supabase database/auth connectivity.',
  permission: 'integrations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const configured = envPresent('SUPABASE_SERVICE_ROLE_KEY') &&
      envPresent('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
    let dbOk = false;
    let error: string | null = null;
    try {
      const supabase = createSupabaseAdminClient();
      const { error: qErr } = await supabase.from('tenants').select('id').eq('id', args.tenant_id).maybeSingle();
      dbOk = !qErr;
      error = qErr?.message || null;
    } catch (err: any) {
      error = err?.message || String(err);
    }
    return {
      name: 'Supabase',
      key: 'supabase',
      status: dbOk ? 'connected' : configured ? 'error' : 'missing',
      connected: dbOk,
      details: { env_configured: configured, error },
    } satisfies IntegrationHealth;
  },
});

defineConnectorTool({
  module: 'integrations-health',
  name: 'openai_health',
  description: 'Health/status for OpenAI API configuration.',
  permission: 'integrations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async () => {
    const configured = envPresent('OPENAI_API_KEY');
    return {
      name: 'OpenAI',
      key: 'openai',
      status: configured ? 'configured' : 'missing',
      connected: configured,
      details: { env_configured: configured },
    } satisfies IntegrationHealth;
  },
});

defineConnectorTool({
  module: 'integrations-health',
  name: 'deepseek_health',
  description: 'Health/status for DeepSeek / OpenRouter reasoning models.',
  permission: 'integrations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async () => {
    const configured = envPresent('DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY');
    return {
      name: 'DeepSeek',
      key: 'deepseek',
      status: configured ? 'configured' : 'missing',
      connected: configured,
      details: {
        deepseek_key: envPresent('DEEPSEEK_API_KEY'),
        openrouter_key: envPresent('OPENROUTER_API_KEY'),
      },
    } satisfies IntegrationHealth;
  },
});

defineConnectorTool({
  module: 'integrations-health',
  name: 'integrations_status',
  description:
    'Aggregate health/status for Alphaclone integrations. Core integrations affect readiness score; Gmail, GitHub, Cal.com, Calendly, and Google Calendar are optional and never reduce the score.',
  permission: 'integrations:read',
  rateLimitClass: 'heavy',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data: rows } = await supabase
      .from('integrations')
      .select('type, enabled, updated_at')
      .eq('tenant_id', args.tenant_id)
      .limit(200);

    const connectedTypes = new Set(
      (rows || [])
        .filter((r: { enabled?: boolean | null }) => r.enabled !== false)
        .map((r: { type?: string | null }) => normalizeIntegrationType(String(r.type || '')))
    );

    const coreChecks = CORE_INTEGRATIONS_FOR_HEALTH.map((key) => {
      let connected = connectedTypes.has(key);
      if (key === 'stripe') connected = connected || envPresent('STRIPE_SECRET_KEY');
      if (key === 'railway') {
        connected =
          connected ||
          Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
      }
      if (key === 'supabase') connected = connected || envPresent('SUPABASE_SERVICE_ROLE_KEY');
      if (key === 'openai') connected = connected || envPresent('OPENAI_API_KEY');
      if (key === 'deepseek') {
        connected = connected || envPresent('DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY');
      }
      return {
        key,
        tier: 'core' as const,
        status: connected ? ('connected' as const) : ('missing' as const),
        connected,
      };
    });

    const optionalChecks = OPTIONAL_INTEGRATIONS_FOR_HEALTH.map((key) => {
      let connected = connectedTypes.has(key);
      if (key === 'github') connected = connected || envPresent('GITHUB_TOKEN', 'GITHUB_APP_ID');
      if (key === 'gmail') {
        connected = connected || connectedTypes.has('google_gmail');
      }
      if (key === 'calcom') {
        connected = connected || connectedTypes.has('cal_com') || envPresent('CAL_OAUTH_CLIENT_ID');
      }
      return {
        key,
        tier: 'optional' as const,
        status: connected ? ('connected' as const) : ('missing' as const),
        connected,
      };
    });

    const coreConnected = coreChecks.filter((c) => c.connected).length;
    const optionalConnected = optionalChecks.filter((c) => c.connected).length;

    return {
      overall: {
        status:
          coreConnected === coreChecks.length
            ? 'ready'
            : coreConnected >= Math.ceil(coreChecks.length * 0.7)
              ? 'degraded'
              : 'needs_setup',
        core_connected: coreConnected,
        core_total: coreChecks.length,
        core_percentage: Math.round((coreConnected / coreChecks.length) * 100),
        optional_connected: optionalConnected,
        optional_total: optionalChecks.length,
        booking_ready: hasBookingIntegration(connectedTypes),
        note: 'Gmail, GitHub, and Cal.com are optional and do not reduce core readiness.',
      },
      core_integrations: coreChecks,
      optional_integrations: optionalChecks,
      tenant_integration_rows: rows || [],
      generated_at: new Date().toISOString(),
    };
  },
});
