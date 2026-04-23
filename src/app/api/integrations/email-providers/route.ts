import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { integrationEmailProviderDeleteSchema, integrationEmailProviderSchema } from '@/schemas/validation';

type ProviderType = 'resend' | 'brevo';

function getProviderName(provider: ProviderType) {
  return provider === 'resend' ? 'Resend' : 'Brevo';
}

function createWebhookToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function getWebhookUrl(provider: ProviderType, token: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || '';
  const normalized = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
  if (!normalized) return '';
  return `${normalized}/api/webhooks/email/inbound/${provider}?token=${encodeURIComponent(token)}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || '';
    const provider = (searchParams.get('provider') || '') as ProviderType;

    if (!tenantId || (provider !== 'resend' && provider !== 'brevo')) {
      return NextResponse.json({ error: 'tenantId and valid provider are required', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const tenantCtx = await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('integrations')
      .select('id, enabled, config')
      .eq('tenant_id', tenantId)
      .eq('user_id', tenantCtx.user.id)
      .eq('type', provider)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message, code: 'INTEGRATION_FETCH_FAILED' }, { status: 500 });
    }

    const config = (data?.config || {}) as Record<string, unknown>;
    const webhookToken = String(config.webhookToken || '');
    return NextResponse.json({
      success: true,
      connected: !!data?.enabled,
      config: data?.config || null,
      webhookUrl: webhookToken ? getWebhookUrl(provider, webhookToken) : '',
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load provider integration', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = integrationEmailProviderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
    }
    const tenantId = parsed.data.tenantId;
    const provider = parsed.data.provider;
    const apiKey = parsed.data.apiKey;
    const fromEmail = parsed.data.fromEmail;
    const fromName = parsed.data.fromName || 'AlphaClone Systems';

    const tenantCtx = await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    const { data: existing } = await supabase
      .from('integrations')
      .select('config')
      .eq('tenant_id', tenantId)
      .eq('user_id', tenantCtx.user.id)
      .eq('type', provider)
      .maybeSingle();

    const existingConfig = (existing?.config || {}) as Record<string, unknown>;
    const webhookToken = String(existingConfig.webhookToken || createWebhookToken());

    const payload = {
      tenant_id: tenantId,
      user_id: tenantCtx.user.id,
      type: provider,
      name: getProviderName(provider),
      enabled: true,
      config: {
        ...existingConfig,
        apiKey,
        api_key: apiKey,
        fromEmail,
        from_email: fromEmail,
        fromName,
        from_name: fromName,
        webhookToken,
      },
    };

    const firstTry = await supabase
      .from('integrations')
      .upsert(payload, { onConflict: 'user_id,type' })
      .select('id')
      .single();

    if (firstTry.error) {
      const secondTry = await supabase
        .from('integrations')
        .upsert(payload, { onConflict: 'tenant_id,user_id,type' })
        .select('id')
        .single();
      if (secondTry.error) {
        return NextResponse.json({ error: secondTry.error.message, code: 'INTEGRATION_UPSERT_FAILED' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, webhookUrl: getWebhookUrl(provider, webhookToken) });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to save provider integration', request);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = integrationEmailProviderDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
    }
    const tenantId = parsed.data.tenantId;
    const provider = parsed.data.provider;

    const tenantCtx = await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', tenantCtx.user.id)
      .eq('type', provider);

    if (error) {
      return NextResponse.json({ error: error.message, code: 'INTEGRATION_DELETE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to disconnect provider integration', request);
  }
}
