import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { EmailProvider } from '@/lib/email/providerSdk';

export type ResolvedEmailProviderConfig = {
  provider: EmailProvider;
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
  ownerUserId?: string | null;
};

function pickProvider(
  rows: Array<{ type: string; config: Record<string, unknown> }>,
  preferredProvider?: EmailProvider
): ResolvedEmailProviderConfig | null {
  const order: EmailProvider[] = preferredProvider
    ? [preferredProvider]
    : ['zoho', 'brevo', 'resend', 'sendgrid', 'gmail'];
  for (const provider of order) {
    const hit = rows.find((row) => row.type === provider);
    const cfg = (hit?.config || {}) as Record<string, unknown>;

    if (provider === 'gmail') {
      // Gmail uses App Password (SMTP) — no OAuth, no global env vars.
      // Config stored in Supabase: { fromEmail: '...@gmail.com', appPassword: 'xxxx xxxx xxxx xxxx' }
      const fromEmail = String(cfg.fromEmail || cfg.from_email || cfg.email || '').trim();
      const appPassword = String(cfg.appPassword || cfg.app_password || cfg.password || '').trim();
      if (!fromEmail || !appPassword) continue;
      return {
        provider: 'gmail',
        apiKey: appPassword,  // apiKey carries the App Password for Gmail
        fromEmail,
        fromName: String(cfg.fromName || cfg.from_name || '').trim() || undefined,
      };
    }

    const apiKey = String(cfg.apiKey || cfg.api_key || '').trim();
    const requiresApiKey = provider === 'brevo' || provider === 'sendgrid' || provider === 'resend';
    if (requiresApiKey && !apiKey) continue;
    return {
      provider,
      apiKey: apiKey || '',
      fromEmail: String(cfg.fromEmail || cfg.from_email || '').trim() || undefined,
      fromName: String(cfg.fromName || cfg.from_name || '').trim() || undefined,
    };
  }
  return null;
}

export async function resolveEmailProviderConfig(params: {
  tenantId?: string | null;
  preferredUserId?: string | null;
  preferredProvider?: EmailProvider;
  fallbackToEnv?: boolean;
  forcePlatform?: boolean;
}): Promise<ResolvedEmailProviderConfig | null> {
  const supabase = createSupabaseAdminClient();
  const tenantId = params.tenantId || null;
  let lookupUserId = params.preferredUserId || null;
<<<<<<< HEAD
  let preferredProvider = params.preferredProvider;

  // Tenant default from business_settings.settings.email.default_provider
  if (tenantId && (!preferredProvider || (preferredProvider as string) === 'system_default')) {
    try {
      const { data: business } = await supabase
        .from('business_settings')
        .select('settings')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const emailSettings = ((business?.settings as Record<string, unknown>)?.email || {}) as Record<string, unknown>;
      const tenantDefault = String(emailSettings.default_provider || emailSettings.defaultProvider || '').trim();
      if (tenantDefault && tenantDefault !== 'auto') {
        preferredProvider = tenantDefault as EmailProvider;
      }
    } catch (err) {
      console.warn('[resolveEmailProviderConfig] Failed to fetch business_settings email provider:', err);
    }
  }

  // Fallback: autonomous_runner_rules email_provider
  if (tenantId && (!preferredProvider || (preferredProvider as string) === 'system_default')) {
    try {
      const { data: rules } = await supabase
        .from('autonomous_runner_rules')
        .select('email_provider')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (rules?.email_provider && rules.email_provider !== 'system_default') {
        preferredProvider = rules.email_provider as EmailProvider;
      }
    } catch (err) {
      console.warn('[resolveEmailProviderConfig] Failed to fetch preferred email provider from rules:', err);
    }
  }
=======
>>>>>>> origin/main

  // 1. If forcePlatform is set, skip DB lookups and go straight to Env
  if (params.forcePlatform) {
    if (process.env.BREVO_PLATFORM_API_KEY) {
      return {
        provider: 'brevo',
        apiKey: process.env.BREVO_PLATFORM_API_KEY,
        fromEmail: process.env.BREVO_FROM_EMAIL || undefined,
        fromName: process.env.BREVO_FROM_NAME || 'AlphaClone Platform',
      };
    }
    // Fallback to BREVO_API_KEY if platform key missing
    if (process.env.BREVO_API_KEY) {
      return {
        provider: 'brevo',
        apiKey: process.env.BREVO_API_KEY,
        fromEmail: process.env.BREVO_FROM_EMAIL || undefined,
      };
    }
  }

  // 2. Standard resolution (User -> Tenant -> Env)
  if (!lookupUserId && tenantId) {
    const { data: membership } = await supabase
      .from('tenant_users')
      .select('user_id, role')
      .eq('tenant_id', tenantId)
      .in('role', ['admin', 'tenant_admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    lookupUserId = membership?.user_id || null;
  }

  if (lookupUserId) {
    const { data } = await supabase
      .from('integrations')
      .select('type, config')
      .eq('user_id', lookupUserId)
      .eq('enabled', true)
      .in('type', ['brevo', 'sendgrid', 'resend', 'zoho', 'gmail']);
    const resolved = pickProvider(
      (data || []) as Array<{ type: string; config: Record<string, unknown> }>,
<<<<<<< HEAD
      preferredProvider
=======
      params.preferredProvider
>>>>>>> origin/main
    );
    if (resolved) return { ...resolved, ownerUserId: lookupUserId };
  }

  if (tenantId) {
    const { data } = await supabase
      .from('integrations')
      .select('type, config, user_id')
      .eq('tenant_id', tenantId)
      .eq('enabled', true)
      .in('type', ['brevo', 'sendgrid', 'resend', 'zoho', 'gmail'])
      .order('updated_at', { ascending: false });

    const grouped = (data || []) as Array<{ type: string; config: Record<string, unknown>; user_id?: string }>;
<<<<<<< HEAD
    const resolved = pickProvider(grouped, preferredProvider);
=======
    const resolved = pickProvider(grouped, params.preferredProvider);
>>>>>>> origin/main
    if (resolved) {
      const source = grouped.find((row) => row.type === resolved.provider);
      return { ...resolved, ownerUserId: source?.user_id || null };
    }
  }

  if (params.fallbackToEnv) {
<<<<<<< HEAD
    if ((!preferredProvider || preferredProvider === 'brevo') && (process.env.BREVO_API_KEY || process.env.BREVO_PLATFORM_API_KEY)) {
=======
    if ((!params.preferredProvider || params.preferredProvider === 'brevo') && (process.env.BREVO_API_KEY || process.env.BREVO_PLATFORM_API_KEY)) {
>>>>>>> origin/main
      return {
        provider: 'brevo',
        apiKey: String(process.env.BREVO_API_KEY || process.env.BREVO_PLATFORM_API_KEY || ''),
        fromEmail: process.env.BREVO_FROM_EMAIL || undefined,
      };
    }
<<<<<<< HEAD
    if ((!preferredProvider || preferredProvider === 'sendgrid') && process.env.SENDGRID_API_KEY) {
=======
    if ((!params.preferredProvider || params.preferredProvider === 'sendgrid') && process.env.SENDGRID_API_KEY) {
>>>>>>> origin/main
      return {
        provider: 'sendgrid',
        apiKey: process.env.SENDGRID_API_KEY,
        fromEmail: process.env.SENDGRID_FROM_EMAIL || undefined,
      };
    }
<<<<<<< HEAD
    if ((!preferredProvider || preferredProvider === 'resend') && process.env.RESEND_API_KEY) {
=======
    if ((!params.preferredProvider || params.preferredProvider === 'resend') && process.env.RESEND_API_KEY) {
>>>>>>> origin/main
      return {
        provider: 'resend',
        apiKey: process.env.RESEND_API_KEY,
      };
    }
  }

  return null;
}
<<<<<<< HEAD

=======
>>>>>>> origin/main
