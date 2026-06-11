import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendWhatsAppMessage, isWhatsAppConfigured } from '@/lib/whatsapp/sendWhatsApp';
import { aiService } from '../ai/aiService';

export class WhatsAppOutreachService {
  async processNewLead(tenantId: string, leadId: string) {
    const supabase = createSupabaseAdminClient();

    // 1. Check settings
    const { data: settings } = await supabase
      .from('whatsapp_chatbot_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!settings || !settings.auto_outreach_enabled) {
      return;
    }

    // 2. Fetch Lead
    const { data: lead } = await supabase
      .from('business_clients') // or leads
      .select('*')
      .eq('id', leadId)
      .maybeSingle();

    if (!lead || !lead.phone || lead.whatsapp_dnc) {
      return;
    }

    // 3. Check Zernio WhatsApp setup
    const waReady = await isWhatsAppConfigured(tenantId);
    if (!waReady) {
      return;
    }

    const phoneToContact = lead.phone.replace(/[^0-9]/g, '');

    // 5. Generate Outreach Message
    const msg = await this.generateOutreachMessage(tenantId, lead, settings.persona_prompt);
    if (!msg) return;

    // 6. Send synchronously. Serverless runtimes may kill delayed timers before they fire.
    console.log(`[WhatsAppOutreach] Sending message for ${phoneToContact}...`);
    const sendResult = await sendWhatsAppMessage({
      tenantId,
      phone: phoneToContact,
      message: msg,
      clientId: leadId,
      metadata: {
        source: 'auto_outreach',
        lead_id: leadId,
      },
    });

    if (!sendResult.success) {
      await supabase.from('whatsapp_outreach_logs').insert({
        tenant_id: tenantId,
        lead_id: leadId,
        phone_number: phoneToContact,
        status: 'failed',
        message_content: msg,
        error_message: sendResult.error || 'WhatsApp send failed',
      });
      throw new Error(sendResult.error || 'WhatsApp send failed');
    }

    await supabase.from('business_clients').update({
      whatsapp_outreach_sent_at: new Date().toISOString()
    }).eq('id', leadId);
  }

  async generateOutreachMessage(tenantId: string, lead: any, persona: string | null) {
    const systemPrompt = `
      ${persona || 'You are an AI assistant.'}
      Write a WhatsApp first outreach message to this lead.
      The message must:
      - Be under 3 sentences
      - Reference something specific about their industry or company
      - Not sound like a mass message
      - End with a simple yes/no question to get a reply
      - NOT mention price or make a pitch yet
    `;

    try {
      const res = await aiService.complete({
        prompt: `Lead Details: ${JSON.stringify(lead)}`,
        systemPrompt,
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20240620'
      });
      return res.content?.trim();
    } catch {
      return null;
    }
  }
}

export const whatsAppOutreachService = new WhatsAppOutreachService();
