import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

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
    }));

    return NextResponse.json({ success: true, integrations });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to fetch WhatsApp integrations', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, wabaId, phoneNumberId, accessToken, alias } = body;

    if (!tenantId || !wabaId || !phoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: 'tenantId, wabaId, phoneNumberId, and accessToken are required' },
        { status: 400 }
      );
    }

    const tenantCtx = await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    // Build the absolute webhook URL for this deployment
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://alphaclonesystems.com';
    const webhookUrl = `${baseUrl}${APP_WEBHOOK_PATH}`;

    // 1. Auto-register webhook with Meta — no manual Meta Dashboard step needed
    const webhookResult = await subscribePhoneToWebhook(phoneNumberId.trim(), accessToken.trim(), webhookUrl);

    // 2. Upsert integration record (even if webhook sub fails, store credentials)
    const { data, error } = await supabase
      .from('whatsapp_integrations')
      .upsert(
        {
          tenant_id: tenantId,
          user_id: tenantCtx.user.id,
          waba_id: wabaId.trim(),
          phone_number_id: phoneNumberId.trim(),
          access_token: accessToken.trim(),
          is_active: true,
          webhook_verified: webhookResult.success,
          metadata: {
            alias: alias || 'Meta WhatsApp API',
            webhook_url: webhookUrl,
            webhook_subscribed_at: webhookResult.success ? new Date().toISOString() : null,
            webhook_error: webhookResult.error || null,
            updated_at: new Date().toISOString(),
          },
        },
        { onConflict: 'tenant_id,waba_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      integration: data,
      webhookSubscribed: webhookResult.success,
      webhookWarning: webhookResult.success ? null : `Webhook auto-subscribe failed: ${webhookResult.error}. You may need to subscribe manually in the Meta Developer Portal.`,
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
