import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { aiService } from '../ai/aiService';

export class ChatbotTrainingService {
  async refreshPersona(tenantId: string) {
    const supabase = createSupabaseAdminClient();

    // 1. Pull recent AI interactions/conversations
    const { data: conversations } = await supabase
      .from('ai_interactions')
      .select('prompt, response')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(30);

    // 2. Pull business snapshot
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle();

    // 3. Synthesize the new persona prompt
    const systemPrompt = `
      You are a communication style analyzer.
      Review the provided user prompts and AI responses, and extract a detailed, concise "Persona Prompt" that captures the communication style, tone, and typical business context of the user.
      This persona prompt will be used to instruct another AI on how to reply to WhatsApp messages on behalf of the business.
      Include specific instructions on tone, verbosity, and any common phrases.
    `;

    const contentToAnalyze = JSON.stringify({
      businessName: tenant?.name || 'The Business',
      recentConversations: conversations || []
    });

    try {
      const res = await aiService.complete({
        prompt: contentToAnalyze,
        systemPrompt
      });


      const persona = res.content?.trim() || '';

      // 4. Save to settings
      await supabase
        .from('whatsapp_chatbot_settings')
        .upsert({
          tenant_id: tenantId,
          persona_prompt: `You are an AI assistant acting on behalf of ${tenant?.name}. \n\nCOMMUNICATION STYLE:\n${persona}`
        }, { onConflict: 'tenant_id' });

      return true;
    } catch (e) {
      console.error('[ChatbotTrainingService] Training failed:', e);
      return false;
    }
  }
}

export const chatbotTrainingService = new ChatbotTrainingService();
