import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { isWhatsAppConfigured } from '@/lib/whatsapp/sendWhatsApp';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getActiveWhatsAppIntegration, getWhatsAppIntegrationProvider } from '@/services/whatsapp/whatsappIntegrationService';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    const envConfigured = !!(ENV.WHATSAPP_PHONE_NUMBER_ID && ENV.WHATSAPP_ACCESS_TOKEN);
    const metaWebhookConfigured = !!(ENV.FACEBOOK_VERIFY_TOKEN && ENV.FACEBOOK_APP_SECRET);
    const supabase = createSupabaseAdminClient();

    let sendConfigured = envConfigured;
    let provider: 'meta' | 'zernio' = 'meta';
    let zernioConfigured = false;
    if (tenantId) {
      await requireTenantAccess(tenantId);
      sendConfigured = await isWhatsAppConfigured(tenantId);
      const activeIntegration = await getActiveWhatsAppIntegration(supabase, tenantId);
      if (activeIntegration) {
        provider = getWhatsAppIntegrationProvider(activeIntegration);
        zernioConfigured = provider === 'zernio';
      }
    }

    return NextResponse.json({
      provider,
      metaWebhookConfigured,
      envConfigured,
      sendConfigured,
      metaConfigured: metaWebhookConfigured,
      zernioConfigured,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load WhatsApp status', request);
  }
}
