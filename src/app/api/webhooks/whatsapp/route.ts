import { NextRequest, NextResponse } from 'next/server';
import { whatsAppChatbotService } from '@/services/whatsapp/WhatsAppChatbotService';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Fire and forget so we don't block Green API
    // which expects a fast 200 OK
    whatsAppChatbotService.handleInboundMessage(payload).catch((e) => {
      console.error('[WhatsApp Webhook] Error processing message:', e);
    });

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (e: any) {
    console.error('[WhatsApp Webhook] Invalid payload:', e);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
