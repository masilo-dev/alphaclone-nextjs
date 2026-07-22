import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

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
      details: { tenant_rows: rows.length, env_configured: configured, error },
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
      details: { accounts: gmail || [], integration_rows: rows.length },
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
      status: rows.length ? 'connected' : 'missing',
      connected: rows.length > 0,
      details: { integration_rows: rows },
    } satisfies IntegrationHealth;
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
    'Aggregate health/status for all Alphaclone integrations (GitHub, Gmail, Google Calendar, Zoho, Stripe, Calendly, Railway, Supabase, OpenAI, DeepSeek).',
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

    const connectedTypes = new Set((rows || []).map((r: any) => String(r.type).toLowerCase()));
    const checks = [
      { key: 'github', connected: connectedTypes.has('github') || envPresent('GITHUB_TOKEN') },
      { key: 'gmail', connected: connectedTypes.has('gmail') || connectedTypes.has('google_gmail') },
      { key: 'google_calendar', connected: connectedTypes.has('google_calendar') },
      { key: 'zoho', connected: connectedTypes.has('zoho') || connectedTypes.has('zoho_mail') },
      { key: 'stripe', connected: connectedTypes.has('stripe') || envPresent('STRIPE_SECRET_KEY') },
      { key: 'calendly', connected: connectedTypes.has('calendly') },
      {
        key: 'railway',
        connected: Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID),
      },
      {
        key: 'supabase',
        connected: envPresent('SUPABASE_SERVICE_ROLE_KEY'),
      },
      { key: 'openai', connected: envPresent('OPENAI_API_KEY') },
      { key: 'deepseek', connected: envPresent('DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY') },
    ];

    const connected = checks.filter((c) => c.connected).length;
    return {
      overall: {
        connected,
        total: checks.length,
        percentage: Math.round((connected / checks.length) * 100),
      },
      integrations: checks.map((c) => ({
        key: c.key,
        status: c.connected ? 'connected' : 'missing',
        connected: c.connected,
      })),
      tenant_integration_rows: rows || [],
      generated_at: new Date().toISOString(),
    };
  },
});
