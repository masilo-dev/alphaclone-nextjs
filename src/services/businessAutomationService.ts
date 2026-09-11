import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { aiGenerationService } from './aiGenerationService';
import { emailHelpers } from './email/emailService';

export const businessAutomationService = {
  /**
   * Identifies leads that have been stuck in the same stage for 30+ days
   * and triggers an AI-powered re-engagement sequence.
   */
  async convertStagnantLeads(tenantId?: string) {
    const tid = tenantId || tenantService.getCurrentTenantId();
    if (!tid) return { success: false, error: 'No tenant context found.' };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch leads updated more than 30 days ago that aren't closed/disqualified
    const { data: stagnantLeads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('tenant_id', tid)
      .lt('updated_at', thirtyDaysAgo.toISOString())
      .not('status', 'in', '("converted", "disqualified")');

    if (error) return { success: false, error: error.message };
    if (!stagnantLeads || stagnantLeads.length === 0) return { success: true, count: 0 };

    const results = await Promise.all(stagnantLeads.map(async (lead: any) => {
      try {
        // 1. Generate personalized re-engagement message
        const prompt = `
          BUSINESS CONTEXT: Lead re-engagement for ${lead.business_name || lead.contact_name}.
          INDUSTRY: ${lead.industry || 'General Business'}.
          STAGNATION: This lead has not been contacted for over 30 days.
          GOAL: Write a short, punchy, "AlphaClone" style email (confident, energetic, zero fluff) to reignite the conversation.
          
          RULES:
          - Max 80 words.
          - Use a bold subject line.
          - Focus on delivering immediate value.
        `;
        
        const res = await aiGenerationService.generateContent(
          lead.owner_id || 'system',
          'admin',
          prompt,
          'email'
        );

        if (!res.success) throw new Error(res.error);

        // 2. Log the automation run to the platform
        await supabase.from('automation_logs').insert({
          tenant_id: tid,
          entity_type: 'lead',
          entity_id: lead.id,
          action: 'convert_stagnant_leads',
          status: 'success',
          metadata: {
            generated_message: res.content,
            lead_name: lead.contact_name
          }
        });

        // 3. Update the lead's status/notes
        await supabase.from('leads').update({
          notes: `${lead.notes || ''}\n[AUTOMATION ${new Date().toISOString()}] Triggered stagnant re-engagement sequence.`
        }).eq('id', lead.id);

        return { leadId: lead.id, status: 'success' };
      } catch (err) {
        console.error(`Failed to automate lead ${lead.id}:`, err);
        return { leadId: lead.id, status: 'failed', error: String(err) };
      }
    }));

    return { 
      success: true, 
      count: results.filter(r => r.status === 'success').length,
      total: stagnantLeads.length 
    };
  },

  /**
   * Identifies open deals with no activity and triggers a "revenue activation" sequence.
   * This handles follow-ups or limited-time offers to close pending proposals.
   */
  async triggerRevenueActivation(tenantId?: string) {
    const tid = tenantId || tenantService.getCurrentTenantId();
    if (!tid) return { success: false, error: 'No tenant context found.' };

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Fetch open deals with no activity for 14 days
    const { data: stagnantDeals, error } = await supabase
      .from('deals')
      .select('*')
      .eq('tenant_id', tid)
      .lt('updated_at', fourteenDaysAgo.toISOString())
      .not('stage', 'in', '("closed_won", "closed_lost")');

    if (error) return { success: false, error: error.message };
    if (!stagnantDeals || stagnantDeals.length === 0) return { success: true, count: 0 };

    const results = await Promise.all(stagnantDeals.map(async (deal: any) => {
      try {
        const prompt = `
          REVENUE ACTIVATION: High-priority follow-up for deal "${deal.name}".
          VALUE: $${deal.value.toLocaleString()}.
          STAGNATION: 14 days since last activity.
          GOAL: Generate a high-urgency, "Stripe-style" follow-up email. Suggest a strategy to close (e.g., a "revenue kickstart" bonus if signed this week).
        `;

        const res = await aiGenerationService.generateContent(
          'system',
          'admin',
          prompt,
          'email'
        );

        if (!res.success) throw new Error(res.error);

        // Log the activation
        await supabase.from('automation_logs').insert({
          tenant_id: tid,
          entity_type: 'deal',
          entity_id: deal.id,
          action: 'trigger_revenue_activation',
          status: 'success',
          metadata: {
            strategy: res.content,
            deal_value: deal.value
          }
        });

        return { dealId: deal.id, status: 'success' };
      } catch (err) {
        console.error(`Failed to activate deal ${deal.id}:`, err);
        return { dealId: deal.id, status: 'failed', error: String(err) };
      }
    }));

    return { 
      success: true, 
      count: results.filter(r => r.status === 'success').length,
      total: stagnantDeals.length 
    };
  }
};
