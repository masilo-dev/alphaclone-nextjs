import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { upsertWhatsAppIntegration } from '@/services/whatsapp/whatsappIntegrationService';
import { getTenantZernioSettings } from '@/lib/zernio/client';

const META_GRAPH_VERSION = 'v18.0';
const APP_WEBHOOK_PATH = '/api/webhooks/facebook/whatsapp';

/**
 * Subscribe a phone number to the app's webhook via Meta Graph API.
 * Each tenant does this independently — data stays fully isolated.
 */
async function subscribePhoneToWebhook(
  phoneNumberId: string,
  accessToken: string,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Subscribe the WhatsApp Business Account to the app webhooks
    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/subscribed_apps`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscribed_fields: 'messages' }),
        signal: AbortSignal.timeout(5000),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      console.error('[Meta webhook subscribe] Failed:', data);
      return { success: false, error: data?.error?.message || 'Meta API subscription failed' };
    }
    console.log(`[Meta webhook subscribe] Subscribed phone ${phoneNumberId} -> ${webhookUrl}`);
    return { success: true };
  } catch (err: any) {
    console.error('[Meta webhook subscribe] Error:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('whatsapp_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mask access token for safety — only last 4 chars shown
    const integrations = (data || []).map((item: any) => ({
      ...item,
      access_token: item.access_token ? `••••${item.access_token.slice(-4)}` : null,
      alias: item.metadata?.alias || 'Meta WhatsApp',
      provider: item.metadata?.provider || 'meta',
    }));

    return NextResponse.json({ success: true, integrations });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to fetch WhatsApp integrations', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, wabaId, phoneNumberId, accessToken, alias, provider } = body;
    const selectedProvider = String(provider || 'meta').toLowerCase() === 'zernio' ? 'zernio' : 'meta';

    const tenantCtx = await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();
    const { data: tenantRow, error: tenantError } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError) {
      return NextResponse.json({ error: tenantError.message }, { status: 500 });
    }

    // Build the absolute webhook URL for this deployment
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://alphaclonesystems.com');
    const webhookUrl = `${baseUrl}${APP_WEBHOOK_PATH}`;

    let upsertResult: { integrationId: string | null; error?: string };

    if (selectedProvider === 'zernio') {
      const zernioSettings = (tenantRow?.settings as any)?.zernio || (await getTenantZernioSettings(tenantId));
      const whatsappAccountId = zernioSettings?.whatsappAccountId?.trim();

      if (!whatsappAccountId) {
        return NextResponse.json(
          { error: 'Add a WhatsApp account ID to your tenant Zernio settings before selecting Zernio.' },
          { status: 400 }
        );
      }

      upsertResult = await upsertWhatsAppIntegration({
        tenantId,
        userId: tenantCtx.user.id,
        wabaId: whatsappAccountId,
        phoneNumberId: null,
        accessToken: null,
        webhookVerified: true,
        provider: 'zernio',
        metadata: {
          provider: 'zernio',
          alias: alias || 'Zernio WhatsApp',
          whatsapp_account_id: whatsappAccountId,
          webhook_url: webhookUrl,
          updated_at: new Date().toISOString(),
        },
      });
    } else {
      if (!wabaId || !phoneNumberId || !accessToken) {
        return NextResponse.json(
          { error: 'tenantId, wabaId, phoneNumberId, and accessToken are required for Meta WhatsApp' },
          { status: 400 }
        );
      }

      // 1. Auto-register webhook with Meta — no manual Meta Dashboard step needed
      const webhookResult = await subscribePhoneToWebhook(phoneNumberId.trim(), accessToken.trim(), webhookUrl);

      upsertResult = await upsertWhatsAppIntegration({
        tenantId,
        userId: tenantCtx.user.id,
        wabaId: wabaId.trim(),
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
        webhookVerified: webhookResult.success,
        provider: 'meta',
        metadata: {
          provider: 'meta',
          alias: alias || 'Meta WhatsApp API',
          webhook_url: webhookUrl,
          webhook_subscribed_at: webhookResult.success ? new Date().toISOString() : null,
          webhook_error: webhookResult.error || null,
          updated_at: new Date().toISOString(),
        },
      });

      if (!upsertResult.integrationId) {
        return NextResponse.json({ error: upsertResult.error || 'Failed to save integration' }, { status: 500 });
      }

      const { data, error } = await supabase
        .from('whatsapp_integrations')
        .select('*')
        .eq('id', upsertResult.integrationId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        integration: data,
        webhookSubscribed: true,
        webhookWarning: null,
      });
    }

    if (!upsertResult.integrationId) {
      return NextResponse.json({ error: upsertResult.error || 'Failed to save integration' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('whatsapp_integrations')
      .select('*')
      .eq('id', upsertResult.integrationId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      integration: data,
      webhookSubscribed: selectedProvider === 'zernio',
      webhookWarning: selectedProvider === 'zernio' ? null : null,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to save WhatsApp integration', request);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const id = searchParams.get('id');

    if (!tenantId || !id) {
      return NextResponse.json({ error: 'tenantId and id are required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('whatsapp_integrations')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to delete WhatsApp integration', request);
  }
}
