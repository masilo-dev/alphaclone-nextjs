import { generateText } from '../unifiedAIService';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface IvrRoutingDecision {
  caller_number: string;
  transcript: string;
  detected_intent: 'sales' | 'support' | 'billing' | 'spam' | 'unknown';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  recommended_action: string;
  crm_entity_matched: boolean;
  contact_id?: string;
}

class IvrAgentService {
  /**
   * Parses live call transcripts from an IVR system, maps the caller to a CRM entity,
   * and determines the optimal routing queue based on semantic intent extraction.
   */
  async processCallTranscript(
    supabase: SupabaseClient,
    tenantId: string,
    callerNumber: string,
    transcriptSnippet: string
  ): Promise<IvrRoutingDecision> {
    // 1. Attempt to match caller ID to CRM contact
    // Strip non-numeric characters for matching
    const cleanNumber = callerNumber.replace(/\D/g, '');
    let matchedContactId: string | undefined = undefined;

    if (cleanNumber.length >= 7) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, phone')
        .eq('tenant_id', tenantId);

      if (Array.isArray(contacts)) {
        const match = contacts.find(c => c.phone && c.phone.replace(/\D/g, '').includes(cleanNumber));
        if (match) {
          matchedContactId = match.id;
        }
      }
    }

    // 2. Extract Intent and Urgency using LLM
    const prompt = `You are an IVR Intent Routing Engine. Analyze the following caller transcript snippet.
Determine their intent and urgency.
Categories: sales, support, billing, spam, unknown.
Urgency levels: low, medium, high, critical.

Caller Transcript:
"${transcriptSnippet}"

Provide output STRICTLY in JSON format:
{
  "intent": "sales",
  "urgency": "medium",
  "action": "Route to SDR queue and create a new lead."
}`;

    let intent: any = 'unknown';
    let urgency: any = 'medium';
    let action = 'Route to general operator.';

    try {
      const response = await generateText(prompt, 500, 'deepseek-chat', tenantId);
      const text = response.text || '';
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      
      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(text.slice(start, end));
        intent = parsed.intent || intent;
        urgency = parsed.urgency || urgency;
        action = parsed.action || action;
      }
    } catch (e) {
      console.warn('IVR Intent extraction failed, using defaults.', e);
    }

    // 3. Log the interaction to the CRM timeline
    if (matchedContactId) {
      await supabase.from('messages').insert({
        tenant_id: tenantId,
        sender_id: matchedContactId,
        recipient_id: null,
        content: `[IVR Transcript Log - Intent: ${intent} | Urgency: ${urgency}]\n${transcriptSnippet}`,
        priority: urgency === 'high' || urgency === 'critical' ? 'high' : 'normal',
        message_type: 'call'
      });
    }

    return {
      caller_number: callerNumber,
      transcript: transcriptSnippet,
      detected_intent: intent,
      urgency,
      recommended_action: action,
      crm_entity_matched: !!matchedContactId,
      contact_id: matchedContactId
    };
  }
}

export const ivrAgentService = new IvrAgentService();
