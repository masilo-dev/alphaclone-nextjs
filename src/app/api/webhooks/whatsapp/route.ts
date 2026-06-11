import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/webhooks/whatsapp
 * Meta webhook verification handshake.
 * Meta sends hub.mode, hub.verify_token, hub.challenge as query params.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.FACEBOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn('[WhatsApp Webhook] Verification failed — token mismatch or wrong mode');
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp
 * Receives incoming message events from Meta WhatsApp Cloud API.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[WhatsApp Webhook] Incoming payload:', JSON.stringify(body, null, 2));
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('[WhatsApp Webhook] Failed to parse body:', err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
