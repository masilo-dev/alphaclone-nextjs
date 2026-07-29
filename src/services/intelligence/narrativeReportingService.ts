import { generateText } from '../unifiedAIService';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface NarrativeReport {
  generated_at: string;
  summary: string;
  key_wins: string[];
  risk_areas: string[];
  strategic_recommendation: string;
}

class NarrativeReportingService {
  /**
   * Generates a plain-English executive summary analyzing pipeline performance, 
   * recent wins, and active risks across the tenant workspace.
   */
  async generateExecutiveSummary(
    supabase: SupabaseClient,
    tenantId: string
  ): Promise<NarrativeReport> {
    // 1. Fetch aggregate metrics
    const { data: deals } = await supabase
      .from('deals')
      .select('name, value, stage')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(50);

    const activePipeline = (deals || []).filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost');
    const recentWins = (deals || []).filter(d => d.stage === 'closed_won').slice(0, 5);
    
    const pipelineValue = activePipeline.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const winValue = recentWins.reduce((sum, d) => sum + Number(d.value || 0), 0);

    const context = `
Pipeline Snapshot:
- Active Deals: ${activePipeline.length}
- Total Pipeline Value: $${pipelineValue.toLocaleString()}
- Recent Won Value: $${winValue.toLocaleString()}
- Top Recent Wins: ${recentWins.map(w => w.name).join(', ') || 'None yet'}
    `;

    const prompt = `You are a Chief Revenue Officer. Analyze the following CRM snapshot and write a concise, professional executive narrative.
${context}

Return ONLY valid JSON matching this schema:
{
  "summary": "1-paragraph overview",
  "key_wins": ["Win 1 impact", "Win 2 impact"],
  "risk_areas": ["Risk 1", "Risk 2"],
  "recommendation": "One strategic next step"
}`;

    try {
<<<<<<< HEAD
      const response = await generateText(prompt, 600, 'deepseek-chat', tenantId);
=======
      const response = await generateText(prompt, 600, 'claude-sonnet-4-6-20260217', tenantId);
>>>>>>> origin/main
      const text = response.text || '';
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;

      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(text.slice(start, end));
        return {
          generated_at: new Date().toISOString(),
          summary: parsed.summary || 'Summary unavailable',
          key_wins: parsed.key_wins || [],
          risk_areas: parsed.risk_areas || [],
          strategic_recommendation: parsed.recommendation || 'Continue standard operations.'
        };
      }
    } catch (e) {
      console.warn('Narrative generation failed', e);
    }

    return {
      generated_at: new Date().toISOString(),
      summary: `Total pipeline value sits at $${pipelineValue.toLocaleString()} across ${activePipeline.length} deals.`,
      key_wins: [],
      risk_areas: ['Insufficient data for deep analysis'],
      strategic_recommendation: 'Increase outbound volume to build pipeline depth.'
    };
  }
}

export const narrativeReportingService = new NarrativeReportingService();
