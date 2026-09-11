import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  DELIVERY_PROVIDER_LABELS,
  NATIVE_CAMPAIGNS_PROVIDER,
  normalizeDeliveryProvider,
  type DeliveryEmailProvider,
} from '@/lib/email/emailProviderOptions';
import {
  normalizeEmailAutoReplyMode,
  type EmailAutoReplyMode,
} from '@/lib/email/autoReplySettings';

const patchSchema = z.object({
  tenantId: z.string().uuid(),
  defaultProvider: z.enum(['auto', 'zoho', 'microsoft', 'brevo', 'sendgrid', 'resend', 'gmail']).optional(),
  autoReplyMode: z.enum(['off', 'draft_only', 'auto_send']).optional(),
});

type ConnectedProvider = {
  id: DeliveryEmailProvider;
  label: string;
  connected: boolean;
  native?: boolean;
  campaigns?: boolean;
};

type IntegrationRow = {
  type: string;
  enabled: boolean | null;
  config: Record<string, unknown> | null;
};

async function getConnectedProviders(
  tenantId: string,
  userId: string,
  admin: ReturnType<typeof createSupabaseAdminClient>
): Promise<ConnectedProvider[]> {
  const types = ['zoho', 'brevo', 'sendgrid', 'resend', 'gmail'] as const;
  const { data: userIntegrations } = await admin
    .from('integrations')
    .select('type, enabled, config')
    .eq('user_id', userId)
    .in('type', [...types]);

  const { data: tenantIntegrations } = await admin
    .from('integrations')
    .select('type, enabled, config')
    .eq('tenant_id', tenantId)
    .in('type', [...types])
    .order('updated_at', { ascending: false });

  const allIntegrations = [...(userIntegrations || []), ...(tenantIntegrations || [])];
  const byType = new Map<string, IntegrationRow>();
  for (const item of allIntegrations) {
    if (!byType.has(item.type) || item.enabled) {
      byType.set(item.type, item);
    }
  }

  const { data: msConn } = await admin
    .from('microsoft_connections')
    .select('microsoft_email')
    .or(`user_id.eq.${userId},tenant_id.eq.${tenantId}`)
    .maybeSingle();

  const zohoRow = byType.get('zoho');
  const zohoConfig = (zohoRow?.config || {}) as Record<string, unknown>;
  // Zoho is connected if the tenant has stored their own OAuth tokens in the integrations DB.
  // process.env ZOHO_CLIENT_ID/SECRET are platform OAuth app credentials — NOT a tenant connection.
  const zohoConnected = Boolean(
    zohoRow?.enabled &&
    (zohoConfig.refreshToken || zohoConfig.refresh_token || zohoConfig.access_token || zohoConfig.apiKey || zohoConfig.api_key)
  );

  const checkApi = (type: string) => {
    const row = byType.get(type);
    if (!row?.enabled) return false;
    const cfg = (row.config || {}) as Record<string, unknown>;
    if (type === 'gmail') {
      // Gmail requires fromEmail + App Password stored by the tenant in their own integration row
      return Boolean(cfg.fromEmail || cfg.from_email) && Boolean(cfg.appPassword || cfg.app_password);
    }
    // All other API-key providers (Brevo, SendGrid, Resend): tenant must have stored their own API key
    return Boolean(cfg.apiKey || cfg.api_key);
  };

  return [
    {
      id: 'zoho',
      label: DELIVERY_PROVIDER_LABELS.zoho,
      connected: zohoConnected,
      native: true,
      campaigns: Boolean(zohoConfig.campaignsApiHost || zohoConnected),
    },
    {
      id: 'microsoft',
      label: DELIVERY_PROVIDER_LABELS.microsoft,
      connected: Boolean(msConn?.microsoft_email),
    },
    {
      id: 'brevo',
      label: DELIVERY_PROVIDER_LABELS.brevo,
      connected: checkApi('brevo'),
    },
    {
      id: 'sendgrid',
      label: DELIVERY_PROVIDER_LABELS.sendgrid,
      connected: checkApi('sendgrid'),
    },
    {
      id: 'resend',
      label: DELIVERY_PROVIDER_LABELS.resend,
      connected: checkApi('resend'),
    },
    {
      id: 'gmail',
      label: DELIVERY_PROVIDER_LABELS.gmail,
      connected: checkApi('gmail'),
    },
  ];
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { user, admin } = await requireTenantAccess(tenantId);

    const { data: business } = await admin
      .from('business_settings')
      .select('settings')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const settings = (business?.settings || {}) as Record<string, unknown>;
    const emailSettings = (settings.email || {}) as Record<string, unknown>;
    const defaultProvider = normalizeDeliveryProvider(
      emailSettings.default_provider || emailSettings.defaultProvider || 'auto'
    );
    const autoReplyMode = normalizeEmailAutoReplyMode(
      emailSettings.auto_reply_mode || emailSettings.autoReplyMode
    );

    const connected = await getConnectedProviders(tenantId, user.id, admin);
    const connectedIds = connected.filter((p) => p.connected).map((p) => p.id);

    return NextResponse.json({
      defaultProvider,
      autoReplyMode,
      connectedProviders: connected,
      connectedIds,
      campaignsProvider: NATIVE_CAMPAIGNS_PROVIDER,
      campaignsNote:
        'This campaign builder sends through the connected provider stack directly (Zoho Mail, Brevo, SendGrid, Resend). The separate Zoho Campaigns hub is the native Zoho-only path.',
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load email provider settings', req);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = patchSchema.parse(await req.json());
    const { user, admin } = await requireTenantAccess(body.tenantId);

    if (body.defaultProvider !== undefined && body.defaultProvider !== 'auto') {
      const connected = await getConnectedProviders(body.tenantId, user.id, admin);
      const hit = connected.find((p) => p.id === body.defaultProvider);
      if (!hit?.connected) {
        return NextResponse.json(
          {
            error: `${DELIVERY_PROVIDER_LABELS[body.defaultProvider]} is not connected. Connect it in Settings → Integrations first.`,
            code: 'PROVIDER_NOT_CONNECTED',
          },
          { status: 400 }
        );
      }
    }

    const { data: existing } = await admin
      .from('business_settings')
      .select('settings')
      .eq('tenant_id', body.tenantId)
      .maybeSingle();

    const prevSettings = (existing?.settings || {}) as Record<string, unknown>;
    const prevEmail = (prevSettings.email || {}) as Record<string, unknown>;
    const nextEmail: Record<string, unknown> = {
      ...prevEmail,
      updated_at: new Date().toISOString(),
    };
    if (body.defaultProvider !== undefined) {
      nextEmail.default_provider = body.defaultProvider;
    }
    if (body.autoReplyMode !== undefined) {
      nextEmail.auto_reply_mode = body.autoReplyMode;
    }
    const nextSettings = {
      ...prevSettings,
      email: nextEmail,
    };

    const { error } = await admin.from('business_settings').upsert(
      {
        tenant_id: body.tenantId,
        settings: nextSettings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      defaultProvider: normalizeDeliveryProvider(nextEmail.default_provider),
      autoReplyMode: normalizeEmailAutoReplyMode(nextEmail.auto_reply_mode) as EmailAutoReplyMode,
      savedAt: nextEmail.updated_at,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to save email provider settings', req);
  }
}
