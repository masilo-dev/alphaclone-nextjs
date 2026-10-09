import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface FunnelQueryParams {
  tenantId: string;
  campaignId?: string;
  sequenceId?: string;
  startDate?: string;
  endDate?: string;
}

export interface FunnelStageMetric {
  count: number;
  distinct_leads: number;
  conversion_from_previous: number;
  conversion_from_top: number;
}

export interface FunnelAttributionReport {
  tenant_id: string;
  campaign_id: string | null;
  sequence_id: string | null;
  period: {
    start: string | null;
    end: string | null;
  };
  funnel: {
    outreach_contacted: FunnelStageMetric;
    engaged: FunnelStageMetric;
    qualified_leads: FunnelStageMetric;
    deals_created: FunnelStageMetric;
    deals_won: FunnelStageMetric;
  };
  financials: {
    total_pipeline_value: number;
    won_revenue: number;
    average_deal_size: number;
  };
  attribution_model: 'first_touch' | 'last_touch' | 'distinct_lead';
  generated_at: string;
}

export class CrmFunnelAttributionService {
  /**
   * Compute deduplicated conversion funnel linking outreach -> qualified leads -> deals created -> won revenue.
   * Enforces distinct lead_id and deal_id counts to eliminate double-counting across multi-step sequences.
   */
  static async computeFunnelMetrics(params: FunnelQueryParams): Promise<FunnelAttributionReport> {
    const { tenantId, campaignId, sequenceId, startDate, endDate } = params;
    const admin = createSupabaseAdminClient() as any;

    // 1. Fetch outreach events with tenant isolation
    let eventsQuery = admin
      .from('outreach_events')
      .select('id, lead_id, contact_id, campaign_id, sequence_id, event_type, occurred_at, metadata')
      .eq('tenant_id', tenantId);

    if (campaignId) eventsQuery = eventsQuery.eq('campaign_id', campaignId);
    if (sequenceId) eventsQuery = eventsQuery.eq('sequence_id', sequenceId);
    if (startDate) eventsQuery = eventsQuery.gte('occurred_at', startDate);
    if (endDate) eventsQuery = eventsQuery.lte('occurred_at', endDate);

    const { data: events, error: eventErr } = await eventsQuery;
    if (eventErr) {
      throw new Error(`Failed to query outreach events: ${eventErr.message}`);
    }

    const eventList = events || [];

    // Distinct sets to prevent double counting
    const contactedLeadIds = new Set<string>();
    const contactedRecipientEmails = new Set<string>();
    const engagedLeadIds = new Set<string>();

    for (const ev of eventList) {
      const leadId = ev.lead_id || ev.metadata?.lead_id;
      const email = ev.metadata?.recipient_email;
      if (leadId) contactedLeadIds.add(String(leadId));
      if (email) contactedRecipientEmails.add(String(email).toLowerCase());

      const type = String(ev.event_type || '').toLowerCase();
      if (['opened', 'clicked', 'replied', 'positive_reply', 'meeting_booked'].includes(type)) {
        if (leadId) engagedLeadIds.add(String(leadId));
      }
    }

    // Also include campaign_recipients if campaignId is specified
    if (campaignId) {
      const { data: recipients } = await admin
        .from('campaign_recipients')
        .select('id, contact_id, email, status')
        .eq('tenant_id', tenantId)
        .eq('campaign_id', campaignId);

      for (const r of recipients || []) {
        if (r.email) contactedRecipientEmails.add(String(r.email).toLowerCase());
        if (['delivered', 'opened', 'clicked'].includes(r.status) && r.contact_id) {
          engagedLeadIds.add(String(r.contact_id));
        }
      }
    }

    // 2. Fetch leads associated with outreach to check stage progression
    const allLeadIds = Array.from(contactedLeadIds);
    let qualifiedLeadCount = 0;
    const qualifiedLeadIds = new Set<string>();

    if (allLeadIds.length > 0) {
      // Chunked query for lead records
      const chunkSize = 100;
      for (let i = 0; i < allLeadIds.length; i += chunkSize) {
        const chunk = allLeadIds.slice(i, i + chunkSize);
        const { data: leadRows } = await admin
          .from('leads')
          .select('id, stage, status, value')
          .eq('tenant_id', tenantId)
          .in('id', chunk);

        for (const l of leadRows || []) {
          const stage = String(l.stage || '').toLowerCase();
          if (['qualified', 'proposal', 'negotiation', 'won', 'customer'].includes(stage)) {
            qualifiedLeadIds.add(String(l.id));
          }
        }
      }
      qualifiedLeadCount = qualifiedLeadIds.size;
    }

    // 3. Fetch deals associated with these leads to count pipeline and won revenue without double counting
    let dealsCreatedCount = 0;
    let dealsWonCount = 0;
    let totalPipelineValue = 0;
    let wonRevenue = 0;
    const distinctDealIds = new Set<string>();
    const distinctWonDealIds = new Set<string>();

    if (allLeadIds.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < allLeadIds.length; i += chunkSize) {
        const chunk = allLeadIds.slice(i, i + chunkSize);
        const { data: deals } = await admin
          .from('deals')
          .select('id, lead_id, stage, status, value, amount')
          .eq('tenant_id', tenantId)
          .in('lead_id', chunk);

        for (const d of deals || []) {
          const dealId = String(d.id);
          if (distinctDealIds.has(dealId)) continue; // Enforce distinct deal count
          distinctDealIds.add(dealId);

          const val = Number(d.value || d.amount || 0);
          totalPipelineValue += Number.isFinite(val) ? val : 0;

          const stage = String(d.stage || d.status || '').toLowerCase();
          if (stage === 'won' || stage === 'closed_won') {
            distinctWonDealIds.add(dealId);
            wonRevenue += Number.isFinite(val) ? val : 0;
          }
        }
      }
      dealsCreatedCount = distinctDealIds.size;
      dealsWonCount = distinctWonDealIds.size;
    }

    // 4. Calculate Conversion Funnel Metrics
    const contactedCount = Math.max(contactedLeadIds.size, contactedRecipientEmails.size);
    const engagedCount = engagedLeadIds.size;

    const outreachMetric: FunnelStageMetric = {
      count: contactedCount,
      distinct_leads: contactedCount,
      conversion_from_previous: 1.0,
      conversion_from_top: 1.0,
    };

    const engagedMetric: FunnelStageMetric = {
      count: engagedCount,
      distinct_leads: engagedCount,
      conversion_from_previous: contactedCount > 0 ? engagedCount / contactedCount : 0,
      conversion_from_top: contactedCount > 0 ? engagedCount / contactedCount : 0,
    };

    const qualifiedMetric: FunnelStageMetric = {
      count: qualifiedLeadCount,
      distinct_leads: qualifiedLeadCount,
      conversion_from_previous: engagedCount > 0 ? qualifiedLeadCount / engagedCount : 0,
      conversion_from_top: contactedCount > 0 ? qualifiedLeadCount / contactedCount : 0,
    };

    const dealsCreatedMetric: FunnelStageMetric = {
      count: dealsCreatedCount,
      distinct_leads: dealsCreatedCount,
      conversion_from_previous: qualifiedLeadCount > 0 ? dealsCreatedCount / qualifiedLeadCount : 0,
      conversion_from_top: contactedCount > 0 ? dealsCreatedCount / contactedCount : 0,
    };

    const dealsWonMetric: FunnelStageMetric = {
      count: dealsWonCount,
      distinct_leads: dealsWonCount,
      conversion_from_previous: dealsCreatedCount > 0 ? dealsWonCount / dealsCreatedCount : 0,
      conversion_from_top: contactedCount > 0 ? dealsWonCount / contactedCount : 0,
    };

    return {
      tenant_id: tenantId,
      campaign_id: campaignId || null,
      sequence_id: sequenceId || null,
      period: {
        start: startDate || null,
        end: endDate || null,
      },
      funnel: {
        outreach_contacted: outreachMetric,
        engaged: engagedMetric,
        qualified_leads: qualifiedMetric,
        deals_created: dealsCreatedMetric,
        deals_won: dealsWonMetric,
      },
      financials: {
        total_pipeline_value: totalPipelineValue,
        won_revenue: wonRevenue,
        average_deal_size: dealsWonCount > 0 ? wonRevenue / dealsWonCount : 0,
      },
      attribution_model: 'distinct_lead',
      generated_at: new Date().toISOString(),
    };
  }
}
