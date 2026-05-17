import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { aiService } from '../ai/aiService';

export class WhatsAppChatbotService {
  /**
   * Main entrypoint for Green API webhooks
   */
  async handleInboundMessage(payload: any) {
    if (!payload || !payload.idInstance || !payload.receiptId) {
      console.log('Invalid Green API payload:', payload);
      return;
    }

    const typeWebhook = payload.typeWebhook;
    // We only care about incoming messages
    if (typeWebhook !== 'incomingMessageReceived') return;

    const messageData = payload.messageData;
    if (!messageData || !messageData.textMessageData || !messageData.textMessageData.textMessage) return;

    const senderPhone = payload.senderData?.sender?.replace('@c.us', '');
    const messageText = messageData.textMessageData.textMessage;
    const idInstance = payload.idInstance;

    console.log(`[WhatsAppChatbot] Incoming from ${senderPhone}: ${messageText}`);

    const supabase = createSupabaseAdminClient();

    // 1. Find Tenant by Green API instance (waba_id or stored in metadata)
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

    // 2. Check if Chatbot is Enabled
    const { data: settings } = await supabase
      .from('whatsapp_chatbot_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!settings || !settings.chatbot_enabled) {
      console.log(`[WhatsAppChatbot] Chatbot is disabled for tenant ${tenantId}`);
      return;
    }

    // 3. Check for Handoff status
    // To simplify, if there's an active "human" escalation, we skip.
    // For now, let's just generate a reply and send it.

    // 4. Get Client Context
    const { data: client } = await supabase
      .from('business_clients')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone', `+${senderPhone}`) // Assuming stored with +
      .maybeSingle();

    // 4.5 Save Inbound Message to Unified Messages
    const externalId = payload.receiptId || `wa_in_${Date.now()}`;
    await supabase.from('unified_messages').insert({
      tenant_id: tenantId,
      source: 'whatsapp',
      external_id: externalId,
      direction: 'inbound',
      channel: 'chat',
      body: messageText,
      from_address: senderPhone,
      to_address: idInstance,
      contact_id: client?.id || null,
      read: false,
      replied: false,
      starred: false,
      archived: false,
      folder: 'inbox',
      priority: 'normal',
      needs_response: true,
      auto_replied: true,
      received_at: new Date().toISOString()
    });

    // 5. Generate AI Reply
    const replyText = await this.generateReply(
      tenantId,
      senderPhone,
      messageText,
      settings.persona_prompt,
      client
    );

    if (!replyText) {
       console.log(`[WhatsAppChatbot] AI returned empty reply, skipping.`);
       return;
    }

    // 6. Send Reply via Green API
    await this.sendReply(
        idInstance, 
        integration.metadata?.apiTokenInstance || '', 
        senderPhone, 
        replyText
    );

    // 7. Save Outbound Message to Unified Messages
    await supabase.from('unified_messages').insert({
      tenant_id: tenantId,
      source: 'whatsapp',
      external_id: `wa_out_${Date.now()}`,
      direction: 'outbound',
      channel: 'chat',
      body: replyText,
      from_address: idInstance,
      to_address: senderPhone,
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
}

export const whatsAppChatbotService = new WhatsAppChatbotService();
