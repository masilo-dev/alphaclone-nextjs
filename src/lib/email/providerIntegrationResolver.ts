import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { EmailProvider } from '@/lib/email/providerSdk';

export type ResolvedEmailProviderConfig = {
  tenantId: string;
  provider: EmailProvider;
  providerAccountId: string;
  integrationId?: string | null;
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
  ownerUserId?: string | null;
  accountType?: string | null;
};

/** Tenant outbound priority — Gmail is intentionally last. */
export const TENANT_EMAIL_PROVIDER_ORDER: EmailProvider[] = [
  'zoho', 'brevo', 'sendgrid', 'resend', 'outlook', 'gmail',
];

const INTEGRATION_PROVIDER_TYPES = ['zoho', 'brevo', 'sendgrid', 'resend', 'gmail', 'microsoft', 'microsoft365'] as const;

function normalizeEmailProvider(value: unknown): EmailProvider | null {
  const provider = String(value || '').trim().toLowerCase();
  if (provider === 'microsoft' || provider === 'microsoft365' || provider === 'microsoft_graph') return 'outlook';
  if (provider === 'zoho' || provider === 'brevo' || provider === 'sendgrid' || provider === 'resend' || provider === 'gmail' || provider === 'outlook') return provider;
  return null;
}

function canonicalProvider(provider: EmailProvider): string {
  return provider === 'outlook' ? 'microsoft_graph' : provider;
}

function buildProviderOrder(preferredProvider?: EmailProvider, tenantDefault?: string | null): EmailProvider[] {
  const normalizedDefault = normalizeEmailProvider(tenantDefault);
  return [...new Set([
    preferredProvider,
    normalizedDefault || undefined,
    ...TENANT_EMAIL_PROVIDER_ORDER,
  ].filter(Boolean) as EmailProvider[])];
}

function envProviderConfig(provider: EmailProvider): Omit<ResolvedEmailProviderConfig, 'tenantId' | 'providerAccountId'> | null {
  if (provider === 'brevo') {
    const apiKey = process.env.BREVO_API_KEY || process.env.BREVO_PLATFORM_API_KEY || process.env.SENDINBLUE_API_KEY || '';
    if (!apiKey) return null;
    return { provider, apiKey, fromEmail: process.env.BREVO_FROM_EMAIL || process.env.EMAIL_FROM || undefined, fromName: process.env.BREVO_FROM_NAME || undefined };
  }
  if (provider === 'sendgrid') {
    if (!process.env.SENDGRID_API_KEY) return null;
    return { provider, apiKey: process.env.SENDGRID_API_KEY, fromEmail: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || undefined, fromName: process.env.SENDGRID_FROM_NAME || undefined };
  }
  if (provider === 'resend') {
    if (!process.env.RESEND_API_KEY) return null;
    return { provider, apiKey: process.env.RESEND_API_KEY, fromEmail: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || undefined, fromName: process.env.RESEND_FROM_NAME || undefined };
  }
  return null;
}

async function resolveTenantDefaultProvider(tenantId: string): Promise<EmailProvider | undefined> {
  const supabase = createSupabaseAdminClient();
  const { data: business } = await supabase
    .from('business_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const emailSettings = ((business?.settings as Record<string, unknown>)?.email || {}) as Record<string, unknown>;
  const configured = String(emailSettings.default_provider || emailSettings.defaultProvider || '').trim();
  if (configured && configured !== 'auto' && configured !== 'system_default') {
    return normalizeEmailProvider(configured) || undefined;
  }

  const { data: rules } = await supabase
    .from('autonomous_runner_rules')
    .select('email_provider')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (rules?.email_provider && rules.email_provider !== 'system_default') {
    return normalizeEmailProvider(rules.email_provider) || undefined;
  }
  return undefined;
}

type IntegrationRow = {
  id: string;
  tenant_id: string;
  type: string;
  config: Record<string, unknown>;
  user_id?: string | null;
  updated_at?: string | null;
};

async function loadIntegrationRows(tenantId: string, preferredUserId?: string | null): Promise<IntegrationRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('integrations')
    .select('id, tenant_id, type, config, user_id, updated_at')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
    .in('type', [...INTEGRATION_PROVIDER_TYPES])
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`EMAIL_PROVIDER_INTEGRATIONS_LOOKUP_FAILED: ${error.message}`);
  const rows = (data || []) as IntegrationRow[];
  if (!preferredUserId) return rows;
  return [...rows].sort((a, b) => Number(b.user_id === preferredUserId) - Number(a.user_id === preferredUserId));
}

function resolveIntegrationSecret(provider: EmailProvider, cfg: Record<string, unknown>): { apiKey: string; fromEmail?: string; fromName?: string } | null {
  const fromEmail = String(cfg.fromEmail || cfg.from_email || cfg.email || '').trim() || undefined;
  const fromName = String(cfg.fromName || cfg.from_name || '').trim() || undefined;
  if (provider === 'gmail') {
    const apiKey = String(cfg.appPassword || cfg.app_password || cfg.password || '').trim();
    return fromEmail && apiKey ? { apiKey, fromEmail, fromName } : null;
  }
  if (provider === 'zoho') {
    const apiKey = String(cfg.apiKey || cfg.api_key || cfg.refreshToken || cfg.refresh_token || '').trim();
    return fromEmail || apiKey ? { apiKey, fromEmail, fromName } : null;
  }
  const apiKey = String(cfg.apiKey || cfg.api_key || cfg.refreshToken || cfg.refresh_token || '').trim();
  if ((provider === 'brevo' || provider === 'sendgrid' || provider === 'resend') && !apiKey) return null;
  return { apiKey, fromEmail, fromName };
}

async function accountForIntegration(tenantId: string, provider: EmailProvider, row: IntegrationRow) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_provider_accounts')
    .select('id, tenant_id, owner_user_id, provider, account_type, email_address, display_name, legacy_integration_id')
    .eq('tenant_id', tenantId)
    .eq('legacy_integration_id', row.id)
    .eq('provider', canonicalProvider(provider))
    .eq('connection_status', 'connected')
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(`EMAIL_PROVIDER_ACCOUNT_LOOKUP_FAILED: ${error.message}`);
  return data;
}

async function resolveOutlookConfig(tenantId: string, userId: string): Promise<ResolvedEmailProviderConfig | null> {
  const supabase = createSupabaseAdminClient();
  const { data: connection, error } = await supabase
    .from('microsoft_connections')
    .select('id, tenant_id, user_id, microsoft_email, display_name')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`MICROSOFT_CONNECTION_LOOKUP_FAILED: ${error.message}`);
  if (!connection?.microsoft_email) return null;

  const { data: account, error: accountError } = await supabase
    .from('email_provider_accounts')
    .select('id, owner_user_id, account_type, email_address, display_name')
    .eq('tenant_id', tenantId)
    .eq('provider', 'microsoft_graph')
    .eq('owner_user_id', userId)
    .eq('connection_status', 'connected')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (accountError) throw new Error(`EMAIL_PROVIDER_ACCOUNT_LOOKUP_FAILED: ${accountError.message}`);
  if (!account) return null;

  return {
    tenantId,
    provider: 'outlook',
    providerAccountId: String(account.id),
    apiKey: '',
    fromEmail: String(account.email_address || connection.microsoft_email).trim(),
    fromName: String(account.display_name || connection.display_name || '').trim() || undefined,
    ownerUserId: userId,
    accountType: account.account_type || null,
  };
}

async function ensurePlatformProviderAccount(tenantId: string, config: Omit<ResolvedEmailProviderConfig, 'tenantId' | 'providerAccountId'>): Promise<ResolvedEmailProviderConfig> {
  const supabase = createSupabaseAdminClient();
  const provider = canonicalProvider(config.provider);
  const { data: existing, error: lookupError } = await supabase
    .from('email_provider_accounts')
    .select('id, account_type, owner_user_id, email_address, display_name')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .eq('account_type', 'platform')
    .eq('connection_status', 'connected')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new Error(`PLATFORM_EMAIL_ACCOUNT_LOOKUP_FAILED: ${lookupError.message}`);
  if (existing) {
    return {
      ...config,
      tenantId,
      providerAccountId: String(existing.id),
      ownerUserId: existing.owner_user_id || null,
      fromEmail: existing.email_address || config.fromEmail,
      fromName: existing.display_name || config.fromName,
      accountType: existing.account_type || 'platform',
    };
  }

  // Platform notification provisioning happens before provider execution. This
  // is not a fallback for tenant-owned mail and never copies another tenant's account.
  const { data: created, error } = await supabase
    .from('email_provider_accounts')
    .insert({
      tenant_id: tenantId,
      provider,
      account_type: 'platform',
      email_address: config.fromEmail || null,
      display_name: config.fromName || 'Platform notification service',
      connection_status: 'connected',
      sync_status: 'not_started',
      capabilities: { send: true, platform_notification_only: true },
      allowed_purposes: ['transactional', 'automation'],
    })
    .select('id, account_type')
    .single();
  if (error || !created) throw new Error(`PLATFORM_EMAIL_ACCOUNT_PROVISION_FAILED: ${error?.message || 'no row'}`);
  return { ...config, tenantId, providerAccountId: String(created.id), accountType: 'platform' };
}

/** Return every tenant-owned connected outbound provider in deterministic priority order. */
export async function resolveAllConnectedEmailProviders(params: {
  tenantId: string;
  preferredUserId?: string | null;
  preferredProvider?: EmailProvider;
  fallbackToEnv?: boolean;
  forcePlatform?: boolean;
}): Promise<ResolvedEmailProviderConfig[]> {
  if (!params.tenantId) throw new Error('EMAIL_TENANT_CONTEXT_REQUIRED');

  if (params.forcePlatform) {
    const raw = envProviderConfig('brevo') || envProviderConfig('sendgrid') || envProviderConfig('resend');
    return raw ? [await ensurePlatformProviderAccount(params.tenantId, raw)] : [];
  }

  // Tenant-owned execution never falls back to shared environment credentials.
  if (params.fallbackToEnv) {
    console.warn('[email] Ignoring fallbackToEnv for tenant-owned send; shared provider credentials are platform-only.');
  }

  const tenantDefault = await resolveTenantDefaultProvider(params.tenantId);
  const preferredProvider = normalizeEmailProvider(params.preferredProvider) || tenantDefault;
  const order = buildProviderOrder(preferredProvider, tenantDefault || null);
  const rows = await loadIntegrationRows(params.tenantId, params.preferredUserId);

  const resolved: ResolvedEmailProviderConfig[] = [];
  const seen = new Set<string>();

  for (const provider of order) {
    if (provider === 'outlook') {
      const candidateUsers = [...new Set([
        params.preferredUserId,
        ...rows.filter((r) => normalizeEmailProvider(r.type) === 'outlook').map((r) => r.user_id),
      ].filter(Boolean) as string[])];
      for (const userId of candidateUsers) {
        const outlook = await resolveOutlookConfig(params.tenantId, userId);
        if (!outlook) continue;
        const key = `${outlook.providerAccountId}`;
        if (!seen.has(key)) {
          seen.add(key);
          resolved.push(outlook);
        }
      }
      continue;
    }

    const candidates = rows.filter((row) => normalizeEmailProvider(row.type) === provider);
    for (const row of candidates) {
      const account = await accountForIntegration(params.tenantId, provider, row);
      if (!account) continue;
      if (params.preferredUserId && row.user_id && row.user_id !== params.preferredUserId && account.account_type !== 'shared_mailbox') continue;
      const secretConfig = resolveIntegrationSecret(provider, (row.config || {}) as Record<string, unknown>);
      if (!secretConfig) continue;
      const config: ResolvedEmailProviderConfig = {
        tenantId: params.tenantId,
        provider,
        providerAccountId: String(account.id),
        integrationId: row.id,
        apiKey: secretConfig.apiKey,
        fromEmail: String(account.email_address || secretConfig.fromEmail || '').trim() || undefined,
        fromName: String(account.display_name || secretConfig.fromName || '').trim() || undefined,
        ownerUserId: account.owner_user_id || row.user_id || null,
        accountType: account.account_type || null,
      };
      if (seen.has(config.providerAccountId)) continue;
      seen.add(config.providerAccountId);
      resolved.push(config);
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
  if (!params.tenantId) return null;
  const all = await resolveAllConnectedEmailProviders({
    tenantId: params.tenantId,
    preferredUserId: params.preferredUserId,
    preferredProvider: params.preferredProvider,
    fallbackToEnv: params.fallbackToEnv,
    forcePlatform: params.forcePlatform,
  });
  return all[0] || null;
}
