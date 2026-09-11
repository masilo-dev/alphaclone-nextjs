import type { SupabaseClient } from '@supabase/supabase-js';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
import { whatsAppChatbotService } from '@/services/whatsapp/WhatsAppChatbotService';

export type WhatsAppWebhookProvider = 'meta' | 'zernio';

function cleanPhone(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function providerTag(provider: WhatsAppWebhookProvider): 'meta-whatsapp' | 'zernio-whatsapp' {
  return provider === 'zernio' ? 'zernio-whatsapp' : 'meta-whatsapp';
}

export async function persistInboundWhatsAppMessage(params: {
  supabase: SupabaseClient;
  tenantId: string;
  integrationId: string;
  provider: WhatsAppWebhookProvider;
  providerMessageId: string;
  chatId: string;
  from: string;
  to: string;
  messageType: string;
  body: string;
  rawPayload?: Record<string, unknown> | null;
  media?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  receivedAt?: string;
  status?: string;
  autoReply?: boolean;
}) {
  const receivedAt = params.receivedAt || new Date().toISOString();
  const providerCode = providerTag(params.provider);
  const cleanFrom = cleanPhone(params.from);
  const cleanTo = cleanPhone(params.to);

  await params.supabase.from('whatsapp_messages').upsert(
    {
      tenant_id: params.tenantId,
      integration_id: params.integrationId,
      provider: providerCode,
      provider_message_id: params.providerMessageId,
      chat_id: params.chatId,
      phone_number: cleanFrom || params.from,
      direction: 'inbound',
      message_type: params.messageType,
      body: params.body,
      media: params.media || null,
      status: params.status || 'received',
      sent_by: 'contact',
      raw_payload: params.rawPayload || null,
      metadata: {
        ...(params.metadata || {}),
        provider: providerCode,
      },
      received_at: receivedAt,
    },
    { onConflict: 'tenant_id,provider_message_id' }
  );

  await captureUnifiedMessageFromWebhook({
    supabase: params.supabase,
    tenantId: params.tenantId,
    source: 'whatsapp',
    channel: 'chat',
    direction: 'inbound',
    externalId: params.providerMessageId,
    threadId: params.chatId,
    from: params.from,
    to: cleanTo || params.to,
    subject: null,
    text: params.body,
    html: null,
    receivedAt,
    metadata: {
      ...(params.metadata || {}),
      provider: providerCode,
      whatsapp_provider: params.provider,
    },
  });

  if (params.autoReply !== false) {
    await whatsAppChatbotService.maybeAutoReply(
      params.tenantId,
      params.from,
      params.body,
      params.integrationId
    );
  }
}

