import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfInboxTestDisabled } from '@/lib/security/productionGuard';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
import { whatsAppChatbotService } from '@/services/whatsapp/WhatsAppChatbotService';

export async function POST(req: NextRequest) {
  const denied = denyIfInboxTestDisabled();
  if (denied) return denied;

  try {
    const body = await req.json();
    console.log('[UnifiedInboxWhatsAppWebhook] Received payload:', JSON.stringify(body));

    const { tenantId, from, to, text, externalId, threadId } = body;

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

      // Auto reply test
      await whatsAppChatbotService.maybeAutoReplyMeta(tenantId, from, text);

      return NextResponse.json({ success: true, messageId: message.id });
    }

    return NextResponse.json({ error: 'Invalid payload parameters' }, { status: 400 });
  } catch (err: any) {
    console.error('[UnifiedInboxWhatsAppWebhook] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
