import { createSupabaseAdminClient } from '@/lib/supabase-admin';
<<<<<<< HEAD
import { sendWhatsAppMessage, isWhatsAppConfigured } from '@/lib/whatsapp/sendWhatsApp';
=======
import { sendWhatsAppMessage } from '@/lib/whatsapp/sendWhatsApp';
>>>>>>> origin/main
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

<<<<<<< HEAD
    // 3. Check Zernio WhatsApp setup
    const waReady = await isWhatsAppConfigured(tenantId);
    if (!waReady) {
      return;
    }

    const phoneToContact = lead.phone.replace(/[^0-9]/g, '');

=======
    // 3. Check Green API setup
    const { data: integration } = await supabase
      .from('whatsapp_integrations')
      .select('waba_id, metadata')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (!integration || !integration.metadata?.apiTokenInstance) {
      return;
    }

    // Check Limits (Mock check)
    const phoneToContact = lead.phone.replace(/[^0-9]/g, '');

    // 4. Verify WhatsApp number
    const isValid = await this.checkWhatsAppNumber(integration.waba_id, integration.metadata.apiTokenInstance, phoneToContact);
    if (!isValid) {
      console.log(`[WhatsAppOutreach] Number not on WhatsApp: ${phoneToContact}`);
      return;
    }

>>>>>>> origin/main
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

<<<<<<< HEAD
=======
  async checkWhatsAppNumber(idInstance: string, apiToken: string, phone: string): Promise<boolean> {
    const url = `https://api.green-api.com/waInstance${idInstance}/checkWhatsapp/${apiToken}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone })
      });
      const data = await res.json();
      return data?.existsWhatsapp === true;
    } catch {
      return false;
    }
  }

>>>>>>> origin/main
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
    } catch {
      return null;
    }
  }
<<<<<<< HEAD
=======

  async sendMessage(idInstance: string, apiToken: string, phone: string, text: string) {
    const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiToken}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: `${phone}@c.us`,
        message: text
      })
    });
  }
>>>>>>> origin/main
}

export const whatsAppOutreachService = new WhatsAppOutreachService();
