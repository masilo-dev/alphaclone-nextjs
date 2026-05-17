import { createSupabaseAdminClient } from '@/lib/supabase-admin';
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

    // 5. Generate Outreach Message
    const msg = await this.generateOutreachMessage(tenantId, lead, settings.persona_prompt);
    if (!msg) return;

    // 6. Send with delay
    console.log(`[WhatsAppOutreach] Queuing message for ${phoneToContact}...`);
    
    // Using setTimeout for demo; in production use a real background job queue
    setTimeout(async () => {
       await this.sendMessage(integration.waba_id, integration.metadata.apiTokenInstance, phoneToContact, msg);
       
       // Log
       await supabase.from('whatsapp_outreach_logs').insert({
         tenant_id: tenantId,
         lead_id: leadId,
         phone_number: phoneToContact,
         status: 'sent',
         message_content: msg,
         sent_at: new Date().toISOString()
       });

       // Save to Unified Messages
       await supabase.from('unified_messages').insert({
         tenant_id: tenantId,
         source: 'whatsapp',
         external_id: `wa_outreach_${Date.now()}`,
         direction: 'outbound',
         channel: 'chat',
         body: msg,
         from_address: integration.waba_id,
         to_address: phoneToContact,
         contact_id: leadId,
         read: true,
         replied: false,
         starred: false,
         archived: false,
         folder: 'sent',
         priority: 'normal',
         needs_response: false,
         auto_replied: true,
         sent_at: new Date().toISOString()
       });

       // Update Lead
       await supabase.from('business_clients').update({
         whatsapp_outreach_sent_at: new Date().toISOString()
       }).eq('id', leadId);

    }, (settings.outreach_delay_seconds || 30) * 1000);
  }

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
}

export const whatsAppOutreachService = new WhatsAppOutreachService();
