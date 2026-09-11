import { SupabaseClient } from '@supabase/supabase-js';

export interface RevenuePipelineMetrics {
  adSpend: number;
  totalLeads: number;
  totalOpportunities: number;
  totalCustomers: number;
  totalRevenue: number;
  expectedPipelineValue: number;
  // Computed metrics (number or null if insufficient data)
  costPerLead: number | null;
  leadToOppRate: number | null; // percentage
  leadToCustomerRate: number | null; // percentage
  cac: number | null; // Customer Acquisition Cost
  roas: number | null; // Return on Ad Spend (e.g. 2.5 = 250%)
  formatted: {
    adSpend: string;
    totalRevenue: string;
    expectedPipelineValue: string;
    costPerLead: string;
    leadToOppRate: string;
    leadToCustomerRate: string;
    cac: string;
    roas: string;
  };
}

/**
 * Calculates end-to-end LinkedIn customer acquisition revenue metrics for a tenant.
 */
export async function calculateLinkedInPipelineMetrics(
  admin: SupabaseClient,
  tenantId: string,
  adSpend = 0
): Promise<RevenuePipelineMetrics> {
  // 1. Fetch leads attributed to LinkedIn
  const { data: linkedinLeads } = await admin
    .from('leads')
    .select('id, status, metadata, created_at')
    .eq('tenant_id', tenantId)
    .or('source.eq.linkedin,source.eq.linkedin_lead_form');

  const leadsList = linkedinLeads || [];
  const leadIds = leadsList.map((l) => l.id);
  const totalLeads = leadsList.length;

  // 2. Fetch opportunities linked to these leads or created for tenant with linkedin source
  let opportunities: Array<{ id: string; value?: number; status?: string; stage?: string; probability?: number }> = [];
  if (leadIds.length > 0) {
    const { data: opps } = await admin
      .from('opportunities')
      .select('id, lead_id, value, status, stage, probability')
      .eq('tenant_id', tenantId)
      .in('lead_id', leadIds);
    opportunities = opps || [];
  }

  // Also query opportunities with metadata source linkedin
  const { data: directOpps } = await admin
    .from('opportunities')
    .select('id, lead_id, value, status, stage, probability')
    .eq('tenant_id', tenantId)
    .filter('metadata->>source', 'eq', 'linkedin');

  if (directOpps) {
    const existingIds = new Set(opportunities.map((o) => o.id));
    for (const opp of directOpps) {
      if (!existingIds.has(opp.id)) {
        opportunities.push(opp);
      }
    }
  }

  const totalOpportunities = opportunities.length;

  // Calculate won deals / customers & revenue
  let totalCustomers = 0;
  let totalRevenue = 0;
  let expectedPipelineValue = 0;

  for (const opp of opportunities) {
    const val = Number(opp.value || 0);
    const prob = Number(opp.probability || 50) / 100;
    const isWon = String(opp.status || opp.stage || '').toLowerCase().includes('won');

    if (isWon) {
      totalCustomers += 1;
      totalRevenue += val;
    } else {
      expectedPipelineValue += val * prob;
    }
  }

  // Also check leads table for converted customers if opportunities table doesn't catch all
  const convertedLeads = leadsList.filter((l) =>
    ['won', 'customer', 'closed_won', 'converted'].includes(String(l.status).toLowerCase())
  );
  if (convertedLeads.length > totalCustomers) {
    totalCustomers = convertedLeads.length;
  }

  // 3. Compute Metrics
  const costPerLead = totalLeads > 0 && adSpend > 0 ? adSpend / totalLeads : null;
  const leadToOppRate = totalLeads > 0 ? (totalOpportunities / totalLeads) * 100 : null;
  const leadToCustomerRate = totalLeads > 0 ? (totalCustomers / totalLeads) * 100 : null;
  const cac = totalCustomers > 0 && adSpend > 0 ? adSpend / totalCustomers : null;
  const roas = adSpend > 0 ? totalRevenue / adSpend : null;

  // 4. Human-Readable Formatter
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return {
    adSpend,
    totalLeads,
    totalOpportunities,
    totalCustomers,
    totalRevenue,
    expectedPipelineValue,
    costPerLead,
    leadToOppRate,
    leadToCustomerRate,
    cac,
    roas,
    formatted: {
      adSpend: adSpend > 0 ? formatCurrency(adSpend) : '$0',
      totalRevenue: totalRevenue > 0 ? formatCurrency(totalRevenue) : '$0',
      expectedPipelineValue: expectedPipelineValue > 0 ? formatCurrency(expectedPipelineValue) : '$0',
      costPerLead: costPerLead !== null ? formatCurrency(costPerLead) : 'Insufficient data',
      leadToOppRate: leadToOppRate !== null ? `${leadToOppRate.toFixed(1)}%` : 'Insufficient data',
      leadToCustomerRate: leadToCustomerRate !== null ? `${leadToCustomerRate.toFixed(1)}%` : 'Insufficient data',
      cac: cac !== null ? formatCurrency(cac) : 'Insufficient data',
      roas: roas !== null ? `${roas.toFixed(2)}x` : 'Insufficient data',
    },
  };
}
