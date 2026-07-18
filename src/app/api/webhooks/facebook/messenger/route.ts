import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { verifyFacebookSignature } from '@/lib/webhookUtils';
import { persistMessengerWebhookEntries } from '@/lib/messenger/webhookProcessing';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (!ENV.FACEBOOK_VERIFY_TOKEN) return new NextResponse('Webhook not configured', { status: 503 });
  if (searchParams.get('hub.mode') === 'subscribe' && searchParams.get('hub.verify_token') === ENV.FACEBOOK_VERIFY_TOKEN) {
    return new NextResponse(searchParams.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    if (!await verifyFacebookSignature(bodyText, req.headers.get('x-hub-signature-256'), ENV.FACEBOOK_APP_SECRET)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const body = JSON.parse(bodyText);
    if (body.object === 'page' || body.object === 'instagram') {
      await persistMessengerWebhookEntries({
        supabase: createSupabaseAdminClient() as any,
        objectType: body.object,
        entries: Array.isArray(body.entry) ? body.entry : [],
      });
    }
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[Messenger Webhook] Processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
