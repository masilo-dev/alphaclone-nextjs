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
          // Fetch settings for phone number (wid)
          const settingsUrl = `https://api.green-api.com/waInstance${item.waba_id}/getSettings/${apiToken}`;
          const settingsResp = await fetch(settingsUrl, { signal: AbortSignal.timeout(1500) });
          let phoneNumber = null;
          let country = null;

          if (settingsResp.ok) {
            const settingsData = await settingsResp.json();
            if (settingsData && settingsData.wid) {
              phoneNumber = settingsData.wid.split('@')[0];
              country = settingsData.countryTelegram || null;
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
          webhookUrl: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/webhooks/whatsapp`
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
