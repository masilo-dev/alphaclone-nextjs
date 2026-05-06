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
    : ['brevo', 'sendgrid', 'resend', 'zoho', 'gmail'];
  for (const provider of order) {
    const hit = rows.find((row) => row.type === provider);
    const cfg = (hit?.config || {}) as Record<string, unknown>;
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
      params.preferredProvider
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
    const resolved = pickProvider(grouped, params.preferredProvider);
    if (resolved) {
      const source = grouped.find((row) => row.type === resolved.provider);
      return { ...resolved, ownerUserId: source?.user_id || null };
    }
  }

  if (params.fallbackToEnv) {
    if ((!params.preferredProvider || params.preferredProvider === 'brevo') && (process.env.BREVO_API_KEY || process.env.BREVO_PLATFORM_API_KEY)) {
      return {
        provider: 'brevo',
        apiKey: String(process.env.BREVO_API_KEY || process.env.BREVO_PLATFORM_API_KEY || ''),
        fromEmail: process.env.BREVO_FROM_EMAIL || undefined,
      };
    }
    if ((!params.preferredProvider || params.preferredProvider === 'sendgrid') && process.env.SENDGRID_API_KEY) {
      return {
        provider: 'sendgrid',
        apiKey: process.env.SENDGRID_API_KEY,
        fromEmail: process.env.SENDGRID_FROM_EMAIL || undefined,
      };
    }
    if ((!params.preferredProvider || params.preferredProvider === 'resend') && process.env.RESEND_API_KEY) {
      return {
        provider: 'resend',
        apiKey: process.env.RESEND_API_KEY,
      };
    }
  }

  return null;
}
