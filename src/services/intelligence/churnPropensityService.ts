import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChurnRiskReport {
  client_id: string;
  churn_probability: number; // 0.0 to 1.0
  risk_tier: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: string[];
  last_interaction_days: number;
  unpaid_invoices: number;
}

class ChurnPropensityService {
  /**
   * Calculates the probability of a client churning based on activity silence,
   * payment delinquency, and overall engagement history.
   */
  async calculateChurnRisk(
    supabase: SupabaseClient,
    tenantId: string,
    clientId: string
  ): Promise<ChurnRiskReport> {
    const factors: string[] = [];
    let riskScore = 0.05; // Base 5% baseline churn rate

    // 1. Fetch Client Profile
    const { data: client } = await supabase
      .from('business_clients')
      .select('created_at')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    // 2. Fetch recent communications to check silence window
    const { data: messages } = await supabase
      .from('messages')
      .select('created_at')
      .eq('tenant_id', tenantId)
      .or(`sender_id.eq.${clientId},recipient_id.eq.${clientId}`)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastInteractionDate = messages && messages.length > 0 
      ? new Date(messages[0].created_at) 
      : new Date(client.created_at);

    const daysSinceInteraction = Math.floor((Date.now() - lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceInteraction > 90) {
      riskScore += 0.40;
      factors.push(`Critical Silence: No recorded communication in ${daysSinceInteraction} days.`);
    } else if (daysSinceInteraction > 30) {
      riskScore += 0.15;
      factors.push(`Fading Engagement: No communication in ${daysSinceInteraction} days.`);
    }

    // 3. Fetch Invoice History
    const { data: invoices } = await supabase
      .from('business_invoices')
      .select('status, due_date')
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId);

    const invoiceList = Array.isArray(invoices) ? invoices : [];
    
    const unpaidInvoices = invoiceList.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue');
    const overdueCount = invoiceList.filter(inv => inv.status === 'overdue').length;

    if (overdueCount > 0) {
      riskScore += 0.25;
      factors.push(`Financial Delinquency: ${overdueCount} overdue invoices detected.`);
    } else if (unpaidInvoices.length > 2) {
      riskScore += 0.10;
      factors.push(`Invoice Accumulation: ${unpaidInvoices.length} total unpaid invoices pending.`);
    }

    // Determine Risk Tier
    riskScore = Math.min(0.99, Math.max(0.01, riskScore));
    let tier: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (riskScore >= 0.70) tier = 'critical';
    else if (riskScore >= 0.40) tier = 'high';
    else if (riskScore >= 0.20) tier = 'medium';

    return {
      client_id: clientId,
      churn_probability: Math.round(riskScore * 100) / 100,
      risk_tier: tier,
      risk_factors: factors,
      last_interaction_days: daysSinceInteraction,
      unpaid_invoices: unpaidInvoices.length
    };
  }
}

export const churnPropensityService = new ChurnPropensityService();
