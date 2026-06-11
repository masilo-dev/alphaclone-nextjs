import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { aiService } from '../ai/aiService';

export class WhatsAppChatbotService {
  /**
   * Check if chatbot is enabled and auto-reply via Meta WhatsApp Cloud API
   */
  async maybeAutoReplyMeta(tenantId: string, phone: string, messageText: string, integrationId?: string) {
    const supabase = createSupabaseAdminClient();
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    if (!tenantId || !cleanPhone || !messageText.trim()) return;

    const { data: settings } = await supabase
      .from('whatsapp_chatbot_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

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
      metadata: { source: 'auto_outreach', provider: 'meta-whatsapp' },
    });

    if (sendResult.success) {
      console.log(`[WhatsAppChatbot] Successfully sent AI auto-reply to ${cleanPhone}`);
    } else {
      console.error(`[WhatsAppChatbot] Failed to send AI auto-reply to ${cleanPhone}:`, sendResult.error);
    }
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
}

export const whatsAppChatbotService = new WhatsAppChatbotService();
export default whatsAppChatbotService;
