import { generateText } from '../unifiedAIService';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProposalDraft {
  deal_id: string;
  generated_title: string;
  executive_summary: string;
  proposed_solution: string;
  investment_summary: string;
  status: 'draft' | 'ready';
}

class ProposalGeneratorService {
  /**
   * Autonomously drafts a full-length business proposal using CRM deal context,
   * combining client specific details with playbook sales narrative.
   */
  async generateProposal(
    supabase: SupabaseClient,
    tenantId: string,
    dealId: string
  ): Promise<ProposalDraft> {
    // 1. Gather comprehensive deal context
    const { data: deal } = await supabase
      .from('deals')
      .select('*, contacts(*), business_clients(*)')
      .eq('id', dealId)
      .eq('tenant_id', tenantId)
      .single();

    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    const value = deal.value ? `$${deal.value.toLocaleString()}` : 'TBD';
    const clientName = deal.business_clients?.name || deal.contacts?.company || 'Prospective Client';
    const contactName = deal.contacts?.name || 'Stakeholder';

    // 2. Draft the proposal sections sequentially using AI
    const systemPrompt = `You are an elite Enterprise Solutions Architect and Sales Engineer. 
Draft a professional, compelling section of a business proposal for the client.
Maintain a confident, value-driven tone emphasizing ROI and operational efficiency.`;

    // Executive Summary
    const execPrompt = `${systemPrompt}\n\nDraft a 2-paragraph Executive Summary for deal "${deal.name}" with client "${clientName}". The contact is ${contactName}.`;
<<<<<<< HEAD
    const execResponse = await generateText(execPrompt, 600, 'deepseek-chat', tenantId);
    
    // Proposed Solution
    const solPrompt = `${systemPrompt}\n\nDraft a 3-paragraph Proposed Solution outlining the core implementation and strategic advantages for deal "${deal.name}".`;
    const solResponse = await generateText(solPrompt, 800, 'deepseek-chat', tenantId);

    // Investment Summary
    const invPrompt = `${systemPrompt}\n\nDraft a brief Investment Summary for the estimated value of ${value}. Explain that this covers full licensing, deployment, and onboarding support.`;
    const invResponse = await generateText(invPrompt, 400, 'deepseek-chat', tenantId);
=======
    const execResponse = await generateText(execPrompt, 600, 'claude-sonnet-4-6-20260217', tenantId);
    
    // Proposed Solution
    const solPrompt = `${systemPrompt}\n\nDraft a 3-paragraph Proposed Solution outlining the core implementation and strategic advantages for deal "${deal.name}".`;
    const solResponse = await generateText(solPrompt, 800, 'claude-sonnet-4-6-20260217', tenantId);

    // Investment Summary
    const invPrompt = `${systemPrompt}\n\nDraft a brief Investment Summary for the estimated value of ${value}. Explain that this covers full licensing, deployment, and onboarding support.`;
    const invResponse = await generateText(invPrompt, 400, 'claude-sonnet-4-6-20260217', tenantId);
>>>>>>> origin/main

    return {
      deal_id: dealId,
      generated_title: `AlphaClone Strategic Partnership Proposal: ${clientName}`,
      executive_summary: execResponse.text || '',
      proposed_solution: solResponse.text || '',
      investment_summary: invResponse.text || '',
      status: 'draft'
    };
  }
}

export const proposalGeneratorService = new ProposalGeneratorService();
