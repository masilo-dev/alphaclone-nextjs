import { generateText } from '../unifiedAIService';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ObjectionResponse {
  objection_theme: string;
  rebuttal_script: string;
  recommended_asset: string;
  confidence: number;
}

class ObjectionHandlingService {
  /**
   * Analyzes an incoming buyer objection and generates a customized, 
   * real-time rebuttal script tailored to their persona and deal stage.
   */
  async generateRebuttal(
    supabase: SupabaseClient,
    tenantId: string,
    dealId: string,
    buyerObjection: string
  ): Promise<ObjectionResponse> {
    const { data: deal } = await supabase
      .from('deals')
      .select('name, stage, contacts(name, title)')
      .eq('id', dealId)
      .eq('tenant_id', tenantId)
      .single();

    const buyerTitle = Array.isArray(deal?.contacts) ? deal?.contacts[0]?.title : (deal?.contacts as any)?.title || 'Decision Maker';
    
    const prompt = `You are a Master Sales Negotiator.
A buyer with the title "${buyerTitle}" in the "${deal?.stage || 'Negotiation'}" stage has raised the following objection:
"${buyerObjection}"

Provide a highly empathetic, value-driven rebuttal script. Then classify the core objection theme (e.g., Price, Timing, Trust, Competitor) and recommend a follow-up asset (e.g., ROI Calculator, Case Study).

Output ONLY valid JSON:
{
  "theme": "Price",
  "script": "I completely understand that budget is a priority. However, if we look at...",
  "asset": "ROI Calculator"
}`;

    try {
      const response = await generateText(prompt, 400, 'deepseek-chat', tenantId);
      const text = response.text || '';
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;

      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(text.slice(start, end));
        return {
          objection_theme: parsed.theme || 'Unknown',
          rebuttal_script: parsed.script || 'Please provide more context.',
          recommended_asset: parsed.asset || 'None',
          confidence: 90
        };
      }
    } catch (e) {
      console.warn('Objection parsing failed', e);
    }

    return {
      objection_theme: 'General',
      rebuttal_script: 'I appreciate you sharing that concern. Can you elaborate on what specifically is holding us back?',
      recommended_asset: 'Case Study',
      confidence: 50
    };
  }
}

export const objectionHandlingService = new ObjectionHandlingService();
