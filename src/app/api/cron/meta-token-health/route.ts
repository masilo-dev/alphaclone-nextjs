import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runFacebookTokenHealthCheck } from '@/services/facebook/facebookIntegrationService';
import { runInstagramTokenHealthCheck } from '@/services/instagram/instagramIntegrationService';
import { runWhatsAppTokenHealthCheck } from '@/services/whatsapp/whatsappIntegrationService';

export const dynamic = 'force-dynamic';

/**
 * Daily health check for Meta integrations (Facebook, Instagram, WhatsApp).
 */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const [facebook, instagram, whatsapp] = await Promise.all([
      runFacebookTokenHealthCheck(100),
      runInstagramTokenHealthCheck(100),
      runWhatsAppTokenHealthCheck(100),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      facebook,
      instagram,
      whatsapp,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
