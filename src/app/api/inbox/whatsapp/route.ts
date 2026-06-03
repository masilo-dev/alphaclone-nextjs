import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
import { whatsAppChatbotService } from '@/services/whatsapp/WhatsAppChatbotService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[UnifiedInboxWhatsAppWebhook] Received payload:', JSON.stringify(body));

    const { tenantId, from, to, text, externalId, threadId, idInstance, receiptId } = body;

    // 1. Simplified testing payload
    if (tenantId && from && text) {
      const admin = createSupabaseAdminClient();
      const { message } = await captureUnifiedMessageFromWebhook({
        supabase: admin as any,
        tenantId,
        source: 'whatsapp',
        channel: 'chat',
        direction: 'inbound',
        externalId: externalId || `whatsapp-test-${Date.now()}`,
        threadId: threadId || `whatsapp-thread-${Date.now()}`,
        from,
        to: to || 'whatsapp-business',
        subject: null,
        text,
        receivedAt: new Date().toISOString()
      });
      return NextResponse.json({ success: true, messageId: message.id });
    }

    // 2. Production Green API webhook
    if (idInstance && receiptId) {
      whatsAppChatbotService.handleInboundMessage(body).catch((e) => {
        console.error('[UnifiedInboxWhatsAppWebhook] Chatbot error:', e);
      });
      return NextResponse.json({ status: 'ok' });
    }

    return NextResponse.json({ error: 'Invalid payload parameters' }, { status: 400 });
  } catch (err: any) {
    console.error('[UnifiedInboxWhatsAppWebhook] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
