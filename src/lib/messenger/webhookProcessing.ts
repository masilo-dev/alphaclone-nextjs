import type { SupabaseClient } from '@supabase/supabase-js';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';

function eventTimestamp(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return new Date().toISOString();
  return new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric).toISOString();
}

export async function persistMessengerWebhookEntries(params: {
  supabase: SupabaseClient;
  objectType: 'page' | 'instagram';
  entries: Array<Record<string, any>>;
}): Promise<void> {
  const isInstagram = params.objectType === 'instagram';

  for (const entry of params.entries || []) {
    const externalAccountId = String(entry.id || '').trim();
    if (!externalAccountId) continue;

    const integrationQuery = isInstagram
      ? params.supabase.from('instagram_integrations').select('tenant_id, user_id, facebook_page_id').eq('instagram_account_id', externalAccountId).eq('is_active', true)
      : params.supabase.from('facebook_integrations').select('tenant_id, user_id, page_id').eq('page_id', externalAccountId).eq('is_active', true);
    const { data: integration, error: integrationError } = await integrationQuery.maybeSingle();
    if (integrationError) throw integrationError;
    if (!integration?.tenant_id) continue;

    const pageId = String(isInstagram ? (integration as any).facebook_page_id || externalAccountId : (integration as any).page_id || externalAccountId);
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue;
      const senderId = String(event.sender?.id || '').trim();
      const recipientId = String(event.recipient?.id || '').trim();
      const messageId = String(event.message.mid || '').trim();
      if (!senderId || !recipientId || !messageId) continue;
      const text = typeof event.message.text === 'string' ? event.message.text : null;
      const receivedAt = eventTimestamp(event.timestamp);

      const { data: conversation, error: conversationError } = await params.supabase
        .from('messenger_conversations')
        .upsert({
          tenant_id: integration.tenant_id,
          page_id: pageId,
          sender_id: senderId,
          last_message_preview: text,
          last_message_at: receivedAt,
          is_read: false,
          metadata: {
            source: isInstagram ? 'instagram_webhook' : 'facebook_webhook',
            platform: isInstagram ? 'instagram' : 'messenger',
            external_account_id: externalAccountId,
          },
        }, { onConflict: 'tenant_id,page_id,sender_id' })
        .select('id')
        .single();
      if (conversationError || !conversation) throw conversationError || new Error('Messenger conversation was not persisted');

      const attachments = Array.isArray(event.message.attachments) ? event.message.attachments : [];
      const { error: messageError } = await params.supabase
        .from('messenger_messages')
        .upsert({
          conversation_id: conversation.id,
          mid: messageId,
          sender_id: senderId,
          recipient_id: recipientId,
          text,
          attachments,
          sender_type: 'user',
          created_at: receivedAt,
        }, { onConflict: 'mid' });
      if (messageError) throw messageError;

      await captureUnifiedMessageFromWebhook({
        supabase: params.supabase,
        tenantId: integration.tenant_id,
        source: isInstagram ? 'instagram' : 'facebook',
        channel: 'chat',
        direction: 'inbound',
        externalId: messageId,
        threadId: conversation.id,
        from: senderId,
        to: recipientId,
        subject: null,
        text,
        html: null,
        receivedAt,
        metadata: { pageId, externalAccountId, conversationId: conversation.id },
      });
    }
  }
}
