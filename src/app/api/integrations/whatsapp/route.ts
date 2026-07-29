import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { getPublicAppUrl } from '@/lib/server/appUrl';
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
=======
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
>>>>>>> origin/main

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

<<<<<<< HEAD
    const { admin: supabase } = await requireTenantAccess(tenantId);
=======
    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();
>>>>>>> origin/main

    const { data, error } = await supabase
      .from('whatsapp_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

<<<<<<< HEAD
    // Mask access token for safety — only last 4 chars shown
    const integrations = (data || []).map((item: any) => ({
      ...item,
      access_token: item.access_token ? `••••${item.access_token.slice(-4)}` : null,
      alias: item.metadata?.alias || 'Meta WhatsApp',
      provider: item.metadata?.provider || 'meta',
    }));

    return NextResponse.json({ success: true, integrations });
=======
    // Enrich integrations with real-time Green API details
    const enrichedIntegrations = await Promise.all((data || []).map(async (item: any) => {
      const apiToken = item.metadata?.apiTokenInstance;
      if (apiToken && item.waba_id) {
        try {
          // Fetch settings for phone number (wid) and current webhook
          const settingsUrl = `https://api.green-api.com/waInstance${item.waba_id}/getSettings/${apiToken}`;
          const settingsResp = await fetch(settingsUrl, { signal: AbortSignal.timeout(1500) });
          let phoneNumber = null;
          let country = null;
          let currentWebhookUrl = '';

          if (settingsResp.ok) {
            const settingsData = await settingsResp.json();
            if (settingsData) {
              if (settingsData.wid) {
                phoneNumber = settingsData.wid.split('@')[0];
              }
              country = settingsData.countryTelegram || null;
              currentWebhookUrl = settingsData.webhookUrl || '';
            }
          }

          // Target Webhook URL
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://alphaclonesystems.com';
          const targetWebhookUrl = `${baseUrl}/api/webhooks/whatsapp`;

          // Self-heal: If webhook url is missing or incorrect on Green API instance, fix it programmatically
          if (currentWebhookUrl !== targetWebhookUrl) {
            try {
              const setSettingsUrl = `https://api.green-api.com/waInstance${item.waba_id}/setSettings/${apiToken}`;
              const setSettingsResp = await fetch(setSettingsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  webhookUrl: targetWebhookUrl,
                  incomingWebhook: 'yes',
                  stateWebhook: 'yes'
                }),
                signal: AbortSignal.timeout(1500)
              });
              if (setSettingsResp.ok) {
                console.log(`[Self-Heal Webhook] Automatically registered Green API Webhook URL for instance ${item.waba_id} -> ${targetWebhookUrl}`);
              }
            } catch (err) {
              console.error(`Failed to self-heal Green API Webhook for ${item.waba_id}:`, err);
            }
          }

          // Fetch state (authorized, etc.)
          const stateUrl = `https://api.green-api.com/waInstance${item.waba_id}/getStateInstance/${apiToken}`;
          const stateResp = await fetch(stateUrl, { signal: AbortSignal.timeout(1500) });
          let state = 'unknown';

          if (stateResp.ok) {
            const stateData = await stateResp.json();
            if (stateData && stateData.stateInstance) {
              state = stateData.stateInstance;
            }
          }

          return {
            ...item,
            phone_number: phoneNumber,
            state: state,
            country: country
          };
        } catch (err) {
          console.error(`Failed to fetch Green API details for ${item.waba_id}:`, err);
        }
      }
      return item;
    }));

    return NextResponse.json({ success: true, integrations: enrichedIntegrations });
>>>>>>> origin/main
  } catch (error) {
    return routeErrorResponse(error, 'Failed to fetch WhatsApp integrations', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
<<<<<<< HEAD
    const { tenantId, wabaId, phoneNumberId, accessToken, alias, provider } = body;
    const selectedProvider = String(provider || 'meta').toLowerCase() === 'zernio' ? 'zernio' : 'meta';

    const tenantCtx = await requireTenantAccess(tenantId);
    const supabase = tenantCtx.admin;
    const { data: tenantRow, error: tenantError } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError) {
      return NextResponse.json({ error: tenantError.message }, { status: 500 });
    }

    // Build the absolute webhook URL for this deployment
    const baseUrl = getPublicAppUrl();
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
=======
    const { tenantId, wabaId, apiToken, alias } = body;

    if (!tenantId || !wabaId || !apiToken) {
      return NextResponse.json({ error: 'tenantId, wabaId, and apiToken are required' }, { status: 400 });
    }

    const tenantCtx = await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    // Construct the absolute Webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://alphaclonesystems.com';
    const webhookUrl = `${baseUrl}/api/webhooks/whatsapp`;

    // 1. Programmatically register webhook URL in Green API settings
    try {
      const setSettingsUrl = `https://api.green-api.com/waInstance${wabaId}/setSettings/${apiToken}`;
      const setSettingsResp = await fetch(setSettingsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookUrl,
          incomingWebhook: 'yes',
          stateWebhook: 'yes'
        }),
        signal: AbortSignal.timeout(3000)
      });

      if (!setSettingsResp.ok) {
        console.warn(`Green API Webhook setSettings failed for instance ${wabaId}:`, await setSettingsResp.text());
      } else {
        console.log(`✓ Programmatically registered Green API Webhook URL: ${webhookUrl}`);
      }
    } catch (webhookErr) {
      console.error('Failed to configure Green API webhook url automatically:', webhookErr);
    }

    // 2. Insert into database
    const { data, error } = await supabase
      .from('whatsapp_integrations')
      .insert({
        tenant_id: tenantId,
        user_id: tenantCtx.user.id,
        waba_id: wabaId,
        is_active: true,
        metadata: {
          apiTokenInstance: apiToken,
          alias: alias || 'WhatsApp API',
          webhookUrl: webhookUrl
        }
      })
      .select()
>>>>>>> origin/main
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

<<<<<<< HEAD
    return NextResponse.json({
      success: true,
      integration: data,
      webhookSubscribed: selectedProvider === 'zernio',
      webhookWarning: selectedProvider === 'zernio' ? null : null,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to save WhatsApp integration', request);
=======
    return NextResponse.json({ success: true, integration: data });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to add WhatsApp integration', request);
>>>>>>> origin/main
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

<<<<<<< HEAD
    const { admin: supabase } = await requireTenantAccess(tenantId);
=======
    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();
>>>>>>> origin/main

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
