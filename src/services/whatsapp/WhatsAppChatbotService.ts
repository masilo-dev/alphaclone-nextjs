import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { aiService } from '../ai/aiService';

export class WhatsAppChatbotService {
  private extractMessage(payload: any): { text: string; metadata: Record<string, unknown>; canAutoReply: boolean } | null {
    const messageData = payload?.messageData;
    if (!messageData) return null;

    const typeMessage = messageData.typeMessage || 'unknown';
    const text =
      messageData.textMessageData?.textMessage ||
      messageData.extendedTextMessageData?.text ||
      messageData.fileMessageData?.caption ||
      messageData.fileMessageData?.fileName ||
      messageData.locationMessageData?.nameLocation ||
      messageData.contactMessageData?.displayName ||
      messageData.contactsArrayMessageData?.contacts?.map((contact: any) => contact.displayName).filter(Boolean).join(', ') ||
      '';

    const fallbackByType: Record<string, string> = {
      imageMessage: '[WhatsApp image]',
      videoMessage: '[WhatsApp video]',
      audioMessage: '[WhatsApp audio]',
      documentMessage: '[WhatsApp document]',
      locationMessage: '[WhatsApp location]',
      contactMessage: '[WhatsApp contact]',
      contactsArrayMessage: '[WhatsApp contacts]',
      stickerMessage: '[WhatsApp sticker]',
      pollMessage: '[WhatsApp poll]',
      reactionMessage: '[WhatsApp reaction]',
      deletedMessage: '[WhatsApp deleted message]',
      editedMessage: '[WhatsApp edited message]',
    };

    const body = text || fallbackByType[typeMessage] || `[WhatsApp ${typeMessage}]`;
    return {
      text: body,
      canAutoReply: Boolean(text && (messageData.textMessageData || messageData.extendedTextMessageData)),
      metadata: {
        provider: 'green-api',
        typeWebhook: payload.typeWebhook,
        typeMessage,
        idMessage: payload.idMessage || null,
        receiptId: payload.receiptId || null,
        file: messageData.fileMessageData || null,
        location: messageData.locationMessageData || null,
        contact: messageData.contactMessageData || null,
        contacts: messageData.contactsArrayMessageData || null,
      },
    };
  }

  /**
   * Main entrypoint for Green API webhooks
   */
  async handleInboundMessage(payload: any) {
    if (!payload || !payload.idInstance || !payload.receiptId) {
      console.log('Invalid Green API payload:', payload);
      return;
    }

    const typeWebhook = payload.typeWebhook;
    const isIncoming = typeWebhook === 'incomingMessageReceived';
    const isOutgoing = typeWebhook === 'outgoingMessageReceived' || typeWebhook === 'outgoingAPIMessageReceived';
    const isStatus = typeWebhook === 'outgoingMessageStatus';

    if (!isIncoming && !isOutgoing && !isStatus) {
      console.log(`[WhatsAppChatbot] Skip unhandled webhook type: ${typeWebhook}`);
      return;
    }

    const idInstance = payload.idInstance;
    const supabase = createSupabaseAdminClient();

    // 1. Find Tenant by Green API instance (waba_id)
    const { data: integration, error: intError } = await supabase
      .from('whatsapp_integrations')
      .select('id, tenant_id, metadata')
      .eq('is_active', true)
      .eq('waba_id', idInstance)
      .maybeSingle();

    if (intError || !integration) {
      console.log(`[WhatsAppChatbot] No active tenant found for idInstance ${idInstance}`);
      return;
    }

    const tenantId = integration.tenant_id;

    if (isStatus) {
      const providerMessageId = payload.idMessage || payload.messageData?.idMessage || payload.statusData?.idMessage;
      const status = payload.statusData?.status || payload.statusMessage;
      if (!providerMessageId || !status) return;

      await supabase
        .from('whatsapp_messages')
        .update({
          status,
          raw_payload: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('provider_message_id', providerMessageId);
      return;
    }

    const parsedMessage = this.extractMessage(payload);
    if (!parsedMessage) return;

    const messageText = parsedMessage.text;

    // Resolve client/customer phone number
    let customerPhone = '';
    if (isIncoming) {
      customerPhone = payload.senderData?.sender?.replace('@c.us', '') || '';
    } else {
      customerPhone = payload.recipientData?.recipient?.replace('@c.us', '') || '';
    }

    if (!customerPhone) {
      console.log('[WhatsAppChatbot] Skip: No customer phone resolved from payload');
      return;
    }

    console.log(`[WhatsAppChatbot] Process ${isIncoming ? 'Incoming' : 'Outgoing'} chat for ${customerPhone}: ${messageText}`);

    // 2. Get CRM Contact/Client context
    const { data: client } = await supabase
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.ilike.%${customerPhone}%,mobile.ilike.%${customerPhone}%`)
      .maybeSingle();

    // 3. Save Message to standalone WhatsApp module table
    const providerMessageId = payload.idMessage || payload.messageData?.idMessage || payload.receiptId || `${isIncoming ? 'wa_in' : 'wa_out'}_${Date.now()}`;
    await supabase.from('whatsapp_messages').upsert({
      tenant_id: tenantId,
      integration_id: integration.id,
      provider_message_id: providerMessageId,
      provider_receipt_id: payload.receiptId || null,
      chat_id: isIncoming ? payload.senderData?.chatId || payload.senderData?.sender : payload.recipientData?.chatId || payload.recipientData?.recipient,
      phone_number: customerPhone,
      direction: isIncoming ? 'inbound' : 'outbound',
      message_type: String(parsedMessage.metadata.typeMessage || 'text'),
      body: messageText,
      contact_id: client?.id || null,
      status: isIncoming ? 'received' : 'sent',
      sent_by: isIncoming ? 'contact' : typeWebhook === 'outgoingAPIMessageReceived' ? 'api' : 'phone',
      needs_response: isIncoming,
      auto_replied: false,
      media: parsedMessage.metadata,
      raw_payload: payload,
      metadata: parsedMessage.metadata,
      received_at: isIncoming ? new Date().toISOString() : null,
      sent_at: isIncoming ? null : new Date().toISOString()
    }, { onConflict: 'tenant_id,provider_message_id' });

    // 4. Trigger AI chatbot auto-reply ONLY for inbound messages
    if (!isIncoming || !parsedMessage.canAutoReply) return;

    // Check if Chatbot is Enabled for this tenant
    const { data: settings } = await supabase
      .from('whatsapp_chatbot_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!settings || !settings.chatbot_enabled) {
      console.log(`[WhatsAppChatbot] AI Auto-Reply chatbot is disabled for tenant ${tenantId}`);
      return;
    }

    // 5. Generate AI Reply
    const replyText = await this.generateReply(
      tenantId,
      customerPhone,
      messageText,
      settings.persona_prompt,
      client
    );

    if (!replyText) {
       console.log(`[WhatsAppChatbot] AI returned empty reply, skipping auto-reply.`);
       return;
    }

    // 6. Send Reply via Green API
    await this.sendReply(
        idInstance, 
        integration.metadata?.apiTokenInstance || '', 
        customerPhone, 
        replyText
    );

    // 7. Save AI Outbound Message to standalone WhatsApp messages
    await supabase.from('whatsapp_messages').insert({
      tenant_id: tenantId,
      integration_id: integration.id,
      provider_message_id: `wa_out_ai_${Date.now()}`,
      chat_id: `${customerPhone}@c.us`,
      phone_number: customerPhone,
      direction: 'outbound',
      message_type: 'text',
      body: replyText,
      contact_id: client?.id || null,
      status: 'sent',
      sent_by: 'bot',
      needs_response: false,
      auto_replied: true,
      metadata: { provider: 'green-api', source: 'ai_auto_reply' },
      sent_at: new Date().toISOString()
    });
  }

  async generateReply(
    tenantId: string,
    phone: string,
    messageText: string,
    personaPrompt: string | null,
    clientContext: any | null
  ) {
    const systemPrompt = `
      ${personaPrompt || 'You are a helpful AI assistant for the business.'}
      
      RULES:
      - Never say you are an AI unless directly asked.
      - Never give generic replies — always reference specific context if available.
      - If you do not know something, say "Let me check that and get back to you".
      - ALWAYS reply in full. No one-word answers.
      - Be conversational and professional.

      CLIENT CONTEXT:
      ${clientContext ? JSON.stringify(clientContext) : 'New or unknown contact.'}
    `;

    try {
      const res = await aiService.complete({
        prompt: `Client says: "${messageText}"\n\nPlease provide the exact reply to send back via WhatsApp. Do not include quotes or surrounding text.`,
        systemPrompt,
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20240620'
      });

      return res.content?.trim();
    } catch (e) {
      console.error('[WhatsAppChatbot] AI Generation failed', e);
      return null;
    }
  }

  async sendReply(idInstance: string, apiTokenInstance: string, toPhone: string, text: string) {
    if (!idInstance || !apiTokenInstance) {
        console.error('[WhatsAppChatbot] Missing Green API credentials.');
        return;
    }

    const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${toPhone}@c.us`,
          message: text
        })
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('[WhatsAppChatbot] Green API Error:', err);
      } else {
        console.log(`[WhatsAppChatbot] Sent reply to ${toPhone}`);
      }
    } catch (error) {
      console.error('[WhatsAppChatbot] Request Error:', error);
    }
  }

  /** Auto-reply for Zernio inbound messages (message already saved by webhook). */
  async maybeAutoReplyZernio(tenantId: string, phone: string, messageText: string) {
    const supabase = createSupabaseAdminClient();
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    if (!tenantId || !cleanPhone || !messageText.trim()) return;

    const { data: settings } = await supabase
      .from('whatsapp_chatbot_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!settings?.chatbot_enabled) return;

    const { data: client } = await supabase
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.ilike.%${cleanPhone}%,mobile.ilike.%${cleanPhone}%`)
      .maybeSingle();

    const replyText = await this.generateReply(tenantId, cleanPhone, messageText, settings.persona_prompt, client);
    if (!replyText) return;

    const { sendWhatsAppMessage } = await import('@/lib/whatsapp/sendWhatsApp');
    await sendWhatsAppMessage({
      tenantId,
      phone: cleanPhone,
      message: replyText,
      contactId: client?.id || null,
      metadata: { source: 'ai_auto_reply', provider: 'zernio' },
    });
  }
}

export const whatsAppChatbotService = new WhatsAppChatbotService();
