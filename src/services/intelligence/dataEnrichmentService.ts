import { generateText } from '../unifiedAIService';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface EnrichmentData {
  industry: string;
  employee_count: string;
  estimated_revenue: string;
  tech_stack: string[];
  headquarters: string;
  confidence_score: number;
}

class DataEnrichmentService {
  /**
   * Automatically enriches missing company firmographics using public search heuristics
   * and LLM knowledge graph extraction.
   */
  async enrichCompanyProfile(
    supabase: SupabaseClient,
    tenantId: string,
    companyName: string,
    website?: string
  ): Promise<EnrichmentData> {
    const prompt = `You are a B2B Data Enrichment Agent.
Analyze the following company and provide its firmographic details based on your general knowledge graph.
If a data point is unknown, provide a best-effort estimate or mark as "Unknown".

Company: ${companyName}
Website: ${website || 'Unknown'}

Return ONLY a valid JSON object matching this schema:
{
  "industry": "Software / Manufacturing / etc",
  "employee_count": "100-500",
  "estimated_revenue": "$10M - $50M",
  "tech_stack": ["AWS", "React", "Salesforce"],
  "headquarters": "City, State",
  "confidence_score": 85
}`;

    const defaultData: EnrichmentData = {
      industry: 'Unknown',
      employee_count: 'Unknown',
      estimated_revenue: 'Unknown',
      tech_stack: [],
      headquarters: 'Unknown',
      confidence_score: 0
    };

    try {
      const response = await generateText(prompt, 600, 'claude-sonnet-4-6-20260217', tenantId);
      const text = response.text || '';
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;

      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(text.slice(start, end));
        return {
          industry: parsed.industry || defaultData.industry,
          employee_count: parsed.employee_count || defaultData.employee_count,
          estimated_revenue: parsed.estimated_revenue || defaultData.estimated_revenue,
          tech_stack: Array.isArray(parsed.tech_stack) ? parsed.tech_stack : defaultData.tech_stack,
          headquarters: parsed.headquarters || defaultData.headquarters,
          confidence_score: parsed.confidence_score || defaultData.confidence_score
        };
      }
    } catch (e) {
      console.warn('Enrichment parsing failed', e);
    }

    return defaultData;
  }
}

export const dataEnrichmentService = new DataEnrichmentService();
