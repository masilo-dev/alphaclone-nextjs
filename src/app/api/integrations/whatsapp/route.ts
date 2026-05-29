import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

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
                  outgoingWebhook: 'yes',
                  outgoingMessageWebhook: 'yes',
                  outgoingAPIMessageWebhook: 'yes',
                  stateWebhook: 'yes',
                  statusInstanceChangedWebhook: 'yes'
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
  } catch (error) {
    return routeErrorResponse(error, 'Failed to fetch WhatsApp integrations', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
          outgoingWebhook: 'yes',
          outgoingMessageWebhook: 'yes',
          outgoingAPIMessageWebhook: 'yes',
          stateWebhook: 'yes',
          statusInstanceChangedWebhook: 'yes'
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
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, integration: data });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to add WhatsApp integration', request);
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
