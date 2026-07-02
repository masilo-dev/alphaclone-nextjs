import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveTenantByZernioAccountId } from '@/lib/zernio/resolveTenant';
import { persistInboundWhatsAppMessage } from '@/lib/whatsapp/webhookProcessing';

function cleanPhone(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function firstText(message: Record<string, any>): string {
  return (
    message?.text ||
    message?.body ||
    message?.content ||
    message?.message ||
    message?.caption ||
    ''
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = String(body?.event || '').trim();
    const supabase = createSupabaseAdminClient();

    if (['message.sent', 'message.delivered', 'message.read', 'message.failed'].includes(event)) {
      const message = body?.message || {};
      const platformMessageId = String(message?.platformMessageId || message?.id || '').trim();
      if (platformMessageId) {
        await supabase
          .from('whatsapp_messages')
          .update({ status: event.split('.')[1] })
          .eq('provider_message_id', platformMessageId);
      }
      return NextResponse.json({ success: true });
    }

    if (event === 'message.received') {
      const message = body?.message || {};
      const account = body?.account || {};
      const tenantId =
        (typeof body?.tenantId === 'string' && body.tenantId.trim()) ||
        (typeof account?.tenantId === 'string' && account.tenantId.trim()) ||
        (await resolveTenantByZernioAccountId(String(account?.id || '').trim()));

      if (!tenantId) {
        return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 400 });
      }

      const { data: integration } = await supabase
        .from('whatsapp_integrations')
        .select('id, tenant_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('waba_id', String(account?.id || '').trim())
        .maybeSingle();

      const senderPhone = cleanPhone(message?.sender?.phoneNumber || message?.sender?.id || '');
      const conversationId = String(message?.conversationId || '').trim();
      const platformMessageId = String(message?.platformMessageId || message?.id || `zernio-${Date.now()}`);
      const text = firstText(message) || `[WhatsApp ${message?.attachments?.[0]?.type || 'message'}]`;

      if (integration?.id) {
        await persistInboundWhatsAppMessage({
          supabase: supabase as any,
          tenantId,
          integrationId: integration.id,
          provider: 'zernio',
          providerMessageId: platformMessageId,
          chatId: conversationId || senderPhone || platformMessageId,
          from: senderPhone || String(message?.sender?.id || ''),
          to: String(account?.id || ''),
          messageType: message?.attachments?.[0]?.type || (text ? 'text' : 'message'),
          body: text,
          rawPayload: body,
          media: message?.attachments?.length
            ? {
                attachments: message.attachments,
              }
            : null,
          metadata: {
            zernio_account_id: String(account?.id || ''),
            zernio_conversation_id: conversationId || null,
            zernio_message_id: String(message?.id || ''),
            platform: message?.platform || 'whatsapp',
          },
          receivedAt: body?.timestamp || new Date().toISOString(),
        });
      }

      return NextResponse.json({ success: true });
    }

    if (event === 'conversation.started') {
      const conversation = body?.conversation || {};
      const account = body?.account || {};
      const tenantId =
        (typeof body?.tenantId === 'string' && body.tenantId.trim()) ||
        (typeof account?.tenantId === 'string' && account.tenantId.trim()) ||
        (await resolveTenantByZernioAccountId(String(account?.id || '').trim()));

      if (!tenantId) {
        return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 400 });
      }

      const { data: integration } = await supabase
        .from('whatsapp_integrations')
        .select('id, tenant_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('waba_id', String(account?.id || '').trim())
        .maybeSingle();

      if (integration?.id) {
        await persistInboundWhatsAppMessage({
          supabase: supabase as any,
          tenantId,
          integrationId: integration.id,
          provider: 'zernio',
          providerMessageId: String(body?.id || `conversation-started-${Date.now()}`),
          chatId: String(conversation?.id || conversation?.platformConversationId || body?.id || ''),
          from: String(conversation?.participantId || conversation?.participantUsername || conversation?.participantName || ''),
          to: String(account?.id || ''),
          messageType: 'event',
          body: '[Conversation started]',
          rawPayload: body,
          metadata: {
            zernio_account_id: String(account?.id || ''),
            zernio_conversation_id: String(conversation?.id || ''),
            zernio_event: 'conversation.started',
          },
          receivedAt: body?.timestamp || new Date().toISOString(),
          autoReply: false,
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unsupported Zernio webhook event' }, { status: 400 });
  } catch (error: any) {
    console.error('[Zernio WhatsApp Webhook] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal error' }, { status: 500 });
  }
}
