import * as unifiedAIService from '../unifiedAIService';
import { z } from 'zod';

export interface ArchitectSpecs {
  businessName: string;
  businessType: string;
  goals: string[];
  complexity: 'starter' | 'pro' | 'enterprise';
  blueprint: {
    crm: string;
    billing: string;
    aiAgents: string;
    automations: string[];
  };
  conversionHook: string;
}

export const aiArchitectService = {
  async generateSpecs(businessName: string, businessType: string, goals: string): Promise<ArchitectSpecs> {
    const prompt = `
      You are the AlphaClone AI Architect.
      Create a "High-Performance System Blueprint" for a business with the following details:
      Business Name: ${businessName}
      Business Type: ${businessType}
      Primary Goals: ${goals}

      Respond ONLY with a JSON object in this format:
      {
        "businessName": "...",
        "businessType": "...",
        "goals": ["goal 1", "goal 2"],
        "complexity": "starter|pro|enterprise",
        "blueprint": {
          "crm": "Description of CRM setup",
          "billing": "Description of billing/invoicing setup",
          "aiAgents": "Description of AI agent deployment",
          "automations": ["Automation 1", "Automation 2"]
        },
        "conversionHook": "A powerful 1-sentence reason why they MUST launch this system today."
      }
    `;

    try {
      const result = await unifiedAIService.generateText(prompt, 1000);
      if (result.error || !result.text) throw new Error(result.error || 'Blueprint generation returned no content');
      const response = result.text;

      // Simple JSON extraction to be safe
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Failed to generate blueprint JSON");
      
      return z.object({
        businessName: z.string().min(1), businessType: z.string().min(1), goals: z.array(z.string()).min(1),
        complexity: z.enum(['starter', 'pro', 'enterprise']),
        blueprint: z.object({ crm: z.string(), billing: z.string(), aiAgents: z.string(), automations: z.array(z.string()) }),
        conversionHook: z.string(),
      }).parse(JSON.parse(jsonMatch[0]));
    } catch (error) {
      console.error("AI Architect Error:", error);
      throw error;
    }
  }
};
