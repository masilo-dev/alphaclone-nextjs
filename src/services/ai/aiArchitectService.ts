import * as unifiedAIService from '../unifiedAIService';

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
      const response = result.text || '';

      // Simple JSON extraction to be safe
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Failed to generate blueprint JSON");
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("AI Architect Error:", error);
      // Fallback specs
      return {
        businessName,
        businessType,
        goals: [goals],
        complexity: 'starter',
        blueprint: {
          crm: "Unified Client Pipeline",
          billing: "Automated Global Invoicing",
          aiAgents: "24/7 Lead Qualifier",
          automations: ["Lead to Deal Sync", "Auto-Invoice Generation"]
        },
        conversionHook: "Your system is ready. Launch now to eliminate tool-hopping and recover 10+ hours a week."
      };
    }
  }
};
