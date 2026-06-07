import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveTenantByZernioAccountId } from '@/lib/zernio/resolveTenant';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';

export const dynamic = 'force-dynamic';

function cleanPhone(raw: string): string {
  return String(raw || '').replace(/[^0-9]/g, '');
}

/** Normalize Zernio webhook payloads (supports multiple event shapes). */
function parseZernioInbound(body: Record<string, unknown>) {
  const data = (body.data || body.payload || body) as Record<string, unknown>;
  const accountId = String(data.accountId || body.accountId || '').trim();
  const participantId = cleanPhone(String(data.participantId || data.from || data.phone || data.senderId || ''));
  const text = String(data.message || data.text || data.body || data.content || '').trim();
  const messageId = String(data.messageId || data.id || `zernio_${Date.now()}`);
  const direction = String(data.direction || body.event || '').toLowerCase();
  const isInbound =
    direction === 'inbound' ||
    direction === 'message.received' ||
    direction === 'received' ||
    body.type === 'message.received' ||
    body.event === 'message.received' ||
    (!direction && !!text && !!participantId);

  return { accountId, participantId, text, messageId, isInbound };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { accountId, participantId, text, messageId, isInbound } = parseZernioInbound(body);

    if (!isInbound || !participantId || !text) {
      return NextResponse.json({ success: true, ignored: true });
    }

    const tenantId = await resolveTenantByZernioAccountId(accountId);
    if (!tenantId) {
      console.warn('[webhooks/zernio] No tenant for accountId:', accountId);
      return NextResponse.json({ success: false, error: 'Unknown account' }, { status: 404 });
    }

    const admin = createSupabaseAdminClient();
    const chatId = `${participantId}@c.us`;
    const now = new Date().toISOString();

    const { data: contact } = await admin
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.ilike.%${participantId}%,mobile.ilike.%${participantId}%`)
      .maybeSingle();

    await admin.from('whatsapp_messages').insert({
      tenant_id: tenantId,
      integration_id: null,
      provider_message_id: messageId,
      chat_id: chatId,
      phone_number: participantId,
      direction: 'inbound',
      message_type: 'text',
      body: text,
      contact_id: contact?.id || null,
      status: 'received',
      sent_by: 'human',
      needs_response: true,
      received_at: now,
      metadata: { provider: 'zernio', raw: body },
    });

    await captureUnifiedMessageFromWebhook({
      supabase: admin as any,
      tenantId,
      source: 'whatsapp',
      channel: 'chat',
      direction: 'inbound',
      externalId: messageId,
      threadId: chatId,
      from: participantId,
      to: accountId,
      subject: null,
      text,
      html: null,
      receivedAt: now,
      metadata: { provider: 'zernio' },
    });

    // Auto-reply via chatbot if enabled
    try {
      const { whatsAppChatbotService } = await import('@/services/whatsapp/WhatsAppChatbotService');
      await whatsAppChatbotService.maybeAutoReplyZernio(tenantId, participantId, text);
    } catch (err) {
      console.error('[webhooks/zernio] chatbot error:', err);
    }

    return NextResponse.json({ success: true, tenantId, messageId });
  } catch (error) {
    console.error('[webhooks/zernio]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Webhook failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'zernio-webhook' });
}
