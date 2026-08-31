import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { EmailProvider } from '@/lib/email/providerSdk';

export type ResolvedEmailProviderConfig = {
  provider: EmailProvider;
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
  ownerUserId?: string | null;
};

/** Tenant outbound priority — Gmail is intentionally last. */
export const TENANT_EMAIL_PROVIDER_ORDER: EmailProvider[] = [
  'zoho',
  'brevo',
  'sendgrid',
  'resend',
  'outlook',
  'gmail',
];

const INTEGRATION_PROVIDER_TYPES: EmailProvider[] = [
  'zoho',
  'brevo',
  'sendgrid',
  'resend',
  'gmail',
];

function normalizeEmailProvider(value: unknown): EmailProvider | null {
  const provider = String(value || '').trim().toLowerCase();
  if (provider === 'microsoft' || provider === 'microsoft365') return 'outlook';
  if (
    provider === 'zoho' ||
    provider === 'brevo' ||
    provider === 'sendgrid' ||
    provider === 'resend' ||
    provider === 'gmail' ||
    provider === 'outlook'
  ) {
    return provider;
  }
  return null;
}

function buildProviderOrder(
  preferredProvider?: EmailProvider,
  tenantDefault?: string | null
): EmailProvider[] {
  const normalizedDefault = normalizeEmailProvider(tenantDefault);
  const order = [
    preferredProvider,
    normalizedDefault || undefined,
    ...TENANT_EMAIL_PROVIDER_ORDER,
  ].filter(Boolean) as EmailProvider[];
  return [...new Set(order)];
}

function resolveIntegrationRowConfig(
  provider: EmailProvider,
  cfg: Record<string, unknown>,
  ownerUserId?: string | null
): ResolvedEmailProviderConfig | null {
  if (provider === 'gmail') {
    const fromEmail = String(cfg.fromEmail || cfg.from_email || cfg.email || '').trim();
    const appPassword = String(cfg.appPassword || cfg.app_password || cfg.password || '').trim();
    if (!fromEmail || !appPassword) return null;
    return {
      provider: 'gmail',
      apiKey: appPassword,
      fromEmail,
      fromName: String(cfg.fromName || cfg.from_name || '').trim() || undefined,
      ownerUserId: ownerUserId || null,
    };
  }

  if (provider === 'zoho') {
    const fromEmail = String(cfg.fromEmail || cfg.from_email || cfg.email || '').trim();
    const apiKey = String(cfg.apiKey || cfg.api_key || cfg.refreshToken || cfg.refresh_token || '').trim();
    if (!fromEmail && !apiKey && !ownerUserId) return null;
    return {
      provider: 'zoho',
      apiKey: apiKey || '',
      fromEmail: fromEmail || undefined,
      fromName: String(cfg.fromName || cfg.from_name || '').trim() || undefined,
      ownerUserId: ownerUserId || null,
    };
  }

  const apiKey = String(cfg.apiKey || cfg.api_key || cfg.refreshToken || cfg.refresh_token || '').trim();
  const requiresApiKey = provider === 'brevo' || provider === 'sendgrid' || provider === 'resend';
  if (requiresApiKey && !apiKey) return null;

  return {
    provider,
    apiKey: apiKey || '',
    fromEmail: String(cfg.fromEmail || cfg.from_email || cfg.email || '').trim() || undefined,
    fromName: String(cfg.fromName || cfg.from_name || '').trim() || undefined,
    ownerUserId: ownerUserId || null,
  };
}

function envProviderConfig(provider: EmailProvider): ResolvedEmailProviderConfig | null {
  if (provider === 'brevo') {
    const apiKey =
      process.env.BREVO_API_KEY ||
      process.env.BREVO_PLATFORM_API_KEY ||
      process.env.SENDINBLUE_API_KEY ||
      '';
    if (!apiKey) return null;
    return {
      provider: 'brevo',
      apiKey,
      fromEmail: process.env.BREVO_FROM_EMAIL || process.env.EMAIL_FROM || undefined,
      fromName: process.env.BREVO_FROM_NAME || undefined,
    };
  }
  if (provider === 'sendgrid') {
    if (!process.env.SENDGRID_API_KEY) return null;
    return {
      provider: 'sendgrid',
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || undefined,
      fromName: process.env.SENDGRID_FROM_NAME || undefined,
    };
  }
  if (provider === 'resend') {
    if (!process.env.RESEND_API_KEY) return null;
    return {
      provider: 'resend',
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || undefined,
      fromName: process.env.RESEND_FROM_NAME || undefined,
    };
  }
  return null;
}

async function resolveTenantDefaultProvider(tenantId: string): Promise<EmailProvider | undefined> {
  const supabase = createSupabaseAdminClient();
  try {
    const { data: business } = await supabase
      .from('business_settings')
      .select('settings')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const emailSettings = ((business?.settings as Record<string, unknown>)?.email || {}) as Record<
      string,
      unknown
    >;
    const tenantDefault = String(emailSettings.default_provider || emailSettings.defaultProvider || '').trim();
    if (tenantDefault && tenantDefault !== 'auto' && tenantDefault !== 'system_default') {
      return normalizeEmailProvider(tenantDefault) || undefined;
    }
  } catch (err) {
    console.warn('[resolveEmailProviderConfig] Failed to fetch business_settings email provider:', err);
  }

  try {
    const { data: rules } = await supabase
      .from('autonomous_runner_rules')
      .select('email_provider')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (rules?.email_provider && rules.email_provider !== 'system_default') {
      return normalizeEmailProvider(rules.email_provider) || undefined;
    }
  } catch (err) {
    console.warn('[resolveEmailProviderConfig] Failed to fetch preferred email provider from rules:', err);
  }

  return undefined;
}

async function resolveLookupUserId(
  tenantId: string,
  preferredUserId?: string | null
): Promise<string | null> {
  if (preferredUserId) return preferredUserId;
  const supabase = createSupabaseAdminClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('created_by')
    .eq('id', tenantId)
    .maybeSingle();
  if (tenant?.created_by) return tenant.created_by;

  const { data: membership } = await supabase
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['admin', 'tenant_admin'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return membership?.user_id || null;
}

async function resolveOutlookConfig(userId: string): Promise<ResolvedEmailProviderConfig | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('microsoft_connections')
    .select('microsoft_email, display_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data?.microsoft_email) return null;
  return {
    provider: 'outlook',
    apiKey: '',
    fromEmail: String(data.microsoft_email).trim(),
    fromName: String(data.display_name || '').trim() || undefined,
    ownerUserId: userId,
  };
}

type IntegrationRow = {
  type: string;
  config: Record<string, unknown>;
  user_id?: string | null;
};

async function loadIntegrationRows(
  tenantId: string,
  lookupUserId: string | null
): Promise<IntegrationRow[]> {
  const supabase = createSupabaseAdminClient();
  const rows: IntegrationRow[] = [];

  if (lookupUserId) {
    const { data } = await supabase
      .from('integrations')
      .select('type, config, user_id')
      .eq('user_id', lookupUserId)
      .eq('enabled', true)
      .in('type', INTEGRATION_PROVIDER_TYPES);
    rows.push(...((data || []) as IntegrationRow[]));
  }

  const { data: tenantIntegrations } = await supabase
    .from('integrations')
    .select('type, config, user_id')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
    .in('type', INTEGRATION_PROVIDER_TYPES)
    .order('updated_at', { ascending: false });
  rows.push(...((tenantIntegrations || []) as IntegrationRow[]));

  return rows;
}

/** Return every connected outbound provider for a tenant, in priority order. */
export async function resolveAllConnectedEmailProviders(params: {
  tenantId: string;
  preferredUserId?: string | null;
  preferredProvider?: EmailProvider;
  fallbackToEnv?: boolean;
  forcePlatform?: boolean;
}): Promise<ResolvedEmailProviderConfig[]> {
  if (params.forcePlatform) {
    const platform =
      envProviderConfig('brevo') ||
      ({
        provider: 'brevo' as const,
        apiKey: String(process.env.BREVO_PLATFORM_API_KEY || process.env.BREVO_API_KEY || ''),
        fromEmail: process.env.BREVO_FROM_EMAIL || undefined,
        fromName: process.env.BREVO_FROM_NAME || 'AlphaClone Platform',
      } as ResolvedEmailProviderConfig);
    return platform.apiKey ? [platform] : [];
  }

  const tenantDefault = await resolveTenantDefaultProvider(params.tenantId);
  const preferredProvider =
    params.preferredProvider && params.preferredProvider !== ('system_default' as EmailProvider)
      ? normalizeEmailProvider(params.preferredProvider) || undefined
      : tenantDefault;
  const order = buildProviderOrder(preferredProvider || undefined, tenantDefault || null);
  const lookupUserId = await resolveLookupUserId(params.tenantId, params.preferredUserId);
  const rows = await loadIntegrationRows(params.tenantId, lookupUserId);

  const resolved: ResolvedEmailProviderConfig[] = [];
  const seen = new Set<string>();

  for (const provider of order) {
    if (provider === 'outlook') {
      const outlookUserId = params.preferredUserId || lookupUserId;
      if (!outlookUserId) continue;
      const outlook = await resolveOutlookConfig(outlookUserId);
      if (!outlook) continue;
      const key = `${outlook.provider}:${outlook.fromEmail}:${outlook.ownerUserId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push(outlook);
      continue;
    }

    const hit = rows.find((row) => row.type === provider);
    if (!hit) continue;
    const config = resolveIntegrationRowConfig(
      provider,
      (hit.config || {}) as Record<string, unknown>,
      hit.user_id || lookupUserId
    );
    if (!config) continue;
    const key = `${config.provider}:${config.fromEmail}:${config.ownerUserId}:${config.apiKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push(config);
  }

  if (!resolved.length && params.fallbackToEnv !== false) {
    for (const provider of order) {
      if (provider === 'outlook' || provider === 'gmail' || provider === 'zoho') continue;
      const envConfig = envProviderConfig(provider);
      if (!envConfig) continue;
      const key = `${envConfig.provider}:${envConfig.apiKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push(envConfig);
    }
  }

  return resolved;
}

export async function resolveEmailProviderConfig(params: {
  tenantId?: string | null;
  preferredUserId?: string | null;
  preferredProvider?: EmailProvider;
  fallbackToEnv?: boolean;
  forcePlatform?: boolean;
}): Promise<ResolvedEmailProviderConfig | null> {
  const tenantId = params.tenantId || null;
  if (!tenantId) {
    if (params.forcePlatform) {
      return envProviderConfig('brevo');
    }
    return null;
  }

  const all = await resolveAllConnectedEmailProviders({
    tenantId,
    preferredUserId: params.preferredUserId,
    preferredProvider: params.preferredProvider,
    fallbackToEnv: params.fallbackToEnv,
    forcePlatform: params.forcePlatform,
  });
  return all[0] || null;
}
