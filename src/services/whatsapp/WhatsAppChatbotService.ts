import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { aiService } from '../ai/aiService';

export class WhatsAppChatbotService {
  /**
<<<<<<< HEAD
   * Check if chatbot is enabled and auto-reply via the configured WhatsApp provider
   */
  async maybeAutoReply(tenantId: string, phone: string, messageText: string, integrationId?: string) {
    const supabase = createSupabaseAdminClient();
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    if (!tenantId || !cleanPhone || !messageText.trim()) return;

=======
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

    if (!isIncoming && !isOutgoing) {
      console.log(`[WhatsAppChatbot] Skip unhandled webhook type: ${typeWebhook}`);
      return;
    }

    const messageData = payload.messageData;
    if (!messageData || !messageData.textMessageData || !messageData.textMessageData.textMessage) return;

    const messageText = messageData.textMessageData.textMessage;
    const idInstance = payload.idInstance;

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

    const supabase = createSupabaseAdminClient();

    // 1. Find Tenant by Green API instance (waba_id)
    const { data: integration, error: intError } = await supabase
      .from('whatsapp_integrations')
      .select('tenant_id, metadata')
      .eq('is_active', true)
      .eq('waba_id', idInstance)
      .maybeSingle();

    if (intError || !integration) {
      console.log(`[WhatsAppChatbot] No active tenant found for idInstance ${idInstance}`);
      return;
    }

    const tenantId = integration.tenant_id;

    // 2. Get CRM Contact/Client context
    const { data: client } = await supabase
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.ilike.%${customerPhone}%,mobile.ilike.%${customerPhone}%`)
      .maybeSingle();

    // 3. Save Message to Unified Messages
    const externalId = payload.receiptId || `${isIncoming ? 'wa_in' : 'wa_out'}_${Date.now()}`;
    await supabase.from('unified_messages').insert({
      tenant_id: tenantId,
      source: 'whatsapp',
      external_id: externalId,
      direction: isIncoming ? 'inbound' : 'outbound',
      channel: 'chat',
      body: messageText,
      from_address: isIncoming ? customerPhone : idInstance,
      to_address: isIncoming ? idInstance : customerPhone,
      contact_id: client?.id || null,
      read: isMeOutbound(isIncoming),
      replied: isMeOutbound(isIncoming),
      starred: false,
      archived: false,
      folder: isIncoming ? 'inbox' : 'sent',
      priority: 'normal',
      needs_response: isIncoming,
      auto_replied: false,
      received_at: isIncoming ? new Date().toISOString() : null,
      sent_at: isIncoming ? null : new Date().toISOString()
    });

    // Helper helper
    function isMeOutbound(inbound: boolean) {
      return !inbound;
    }

    // 4. Trigger AI chatbot auto-reply ONLY for inbound messages
    if (!isIncoming) return;

    // Check if Chatbot is Enabled for this tenant
>>>>>>> origin/main
    const { data: settings } = await supabase
      .from('whatsapp_chatbot_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

<<<<<<< HEAD
    if (!settings?.chatbot_enabled) {
      console.log(`[WhatsAppChatbot] Chatbot is disabled for tenant ${tenantId}`);
      return;
    }

    const { data: client } = await supabase
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.ilike.%${cleanPhone}%,mobile.ilike.%${cleanPhone}%`)
      .maybeSingle();

    console.log(`[WhatsAppChatbot] Generating AI reply for ${cleanPhone}...`);
    const replyText = await this.generateReply(tenantId, cleanPhone, messageText, settings.persona_prompt, client);
    if (!replyText) {
      console.log('[WhatsAppChatbot] AI generated an empty response. Skipping.');
      return;
    }

    const { sendWhatsAppMessage } = await import('@/lib/whatsapp/sendWhatsApp');
    const sendResult = await sendWhatsAppMessage({
      tenantId,
      phone: cleanPhone,
      message: replyText,
      integrationId,
      contactId: client?.id || null,
      metadata: { source: 'auto_outreach' },
    });

    if (sendResult.success) {
      console.log(`[WhatsAppChatbot] Successfully sent AI auto-reply to ${cleanPhone}`);
    } else {
      console.error(`[WhatsAppChatbot] Failed to send AI auto-reply to ${cleanPhone}:`, sendResult.error);
    }
  }

  async maybeAutoReplyMeta(tenantId: string, phone: string, messageText: string, integrationId?: string) {
    return this.maybeAutoReply(tenantId, phone, messageText, integrationId);
=======
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

    // 7. Save AI Outbound Message to Unified Messages
    await supabase.from('unified_messages').insert({
      tenant_id: tenantId,
      source: 'whatsapp',
      external_id: `wa_out_ai_${Date.now()}`,
      direction: 'outbound',
      channel: 'chat',
      body: replyText,
      from_address: idInstance,
      to_address: customerPhone,
      contact_id: client?.id || null,
      read: true,
      replied: true,
      starred: false,
      archived: false,
      folder: 'sent',
      priority: 'normal',
      needs_response: false,
      auto_replied: true,
      sent_at: new Date().toISOString()
    });
>>>>>>> origin/main
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
<<<<<<< HEAD
        systemPrompt
      });


=======
        systemPrompt,
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20240620'
      });

>>>>>>> origin/main
      return res.content?.trim();
    } catch (e) {
      console.error('[WhatsAppChatbot] AI Generation failed', e);
      return null;
    }
  }
<<<<<<< HEAD
}

export const whatsAppChatbotService = new WhatsAppChatbotService();
export default whatsAppChatbotService;
=======

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
}

export const whatsAppChatbotService = new WhatsAppChatbotService();
>>>>>>> origin/main
