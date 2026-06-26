import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { isWhatsAppConfigured } from '@/lib/whatsapp/sendWhatsApp';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    const envConfigured = !!(ENV.WHATSAPP_PHONE_NUMBER_ID && ENV.WHATSAPP_ACCESS_TOKEN);
    const metaWebhookConfigured = !!(ENV.FACEBOOK_VERIFY_TOKEN && ENV.FACEBOOK_APP_SECRET);

    let sendConfigured = envConfigured;
    if (tenantId) {
      await requireTenantAccess(tenantId);
      sendConfigured = await isWhatsAppConfigured(tenantId);
    }

    return NextResponse.json({
      provider: 'meta',
      metaWebhookConfigured,
      envConfigured,
      sendConfigured,
      metaConfigured: metaWebhookConfigured,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load WhatsApp status', request);
  }
}
