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
  rows: Array<{ type: string; config: Record<string, unknown> }>
): ResolvedEmailProviderConfig | null {
  const order: EmailProvider[] = ['brevo', 'sendgrid', 'resend'];
  for (const provider of order) {
    const hit = rows.find((row) => row.type === provider);
    const cfg = (hit?.config || {}) as Record<string, unknown>;
    const apiKey = String(cfg.apiKey || cfg.api_key || '').trim();
    if (!apiKey) continue;
    return {
      provider,
      apiKey,
      fromEmail: String(cfg.fromEmail || cfg.from_email || '').trim() || undefined,
      fromName: String(cfg.fromName || cfg.from_name || '').trim() || undefined,
    };
  }
  return null;
}

export async function resolveEmailProviderConfig(params: {
  tenantId?: string | null;
  preferredUserId?: string | null;
  fallbackToEnv?: boolean;
}): Promise<ResolvedEmailProviderConfig | null> {
  const supabase = createSupabaseAdminClient();
  const tenantId = params.tenantId || null;
  let lookupUserId = params.preferredUserId || null;

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
      .in('type', ['brevo', 'sendgrid', 'resend']);
    const resolved = pickProvider((data || []) as Array<{ type: string; config: Record<string, unknown> }>);
    if (resolved) return { ...resolved, ownerUserId: lookupUserId };
  }

  if (tenantId) {
    const { data } = await supabase
      .from('integrations')
      .select('type, config, user_id')
      .eq('tenant_id', tenantId)
      .eq('enabled', true)
      .in('type', ['brevo', 'sendgrid', 'resend'])
      .order('updated_at', { ascending: false });

    const grouped = (data || []) as Array<{ type: string; config: Record<string, unknown>; user_id?: string }>;
    const resolved = pickProvider(grouped);
    if (resolved) {
      const source = grouped.find((row) => row.type === resolved.provider);
      return { ...resolved, ownerUserId: source?.user_id || null };
    }
  }

  if (params.fallbackToEnv) {
    if (process.env.BREVO_API_KEY || process.env.BREVO_PLATFORM_API_KEY) {
      return {
        provider: 'brevo',
        apiKey: String(process.env.BREVO_API_KEY || process.env.BREVO_PLATFORM_API_KEY || ''),
        fromEmail: process.env.BREVO_FROM_EMAIL || undefined,
      };
    }
    if (process.env.SENDGRID_API_KEY) {
      return {
        provider: 'sendgrid',
        apiKey: process.env.SENDGRID_API_KEY,
        fromEmail: process.env.SENDGRID_FROM_EMAIL || undefined,
      };
    }
    if (process.env.RESEND_API_KEY) {
      return {
        provider: 'resend',
        apiKey: process.env.RESEND_API_KEY,
      };
    }
  }

  return null;
}
