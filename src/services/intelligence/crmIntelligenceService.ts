import type { SupabaseClient } from '@supabase/supabase-js';

export interface CompetitorInsight {
  competitor_name: string;
  strength: string;
  weakness: string;
  positioning_playbook: string[];
}

export interface Touchpoint {
  channel: string;
  timestamp: string;
  asset: string;
}

export interface AttributionReport {
  first_touch: Record<string, number>;
  last_touch: Record<string, number>;
  linear: Record<string, number>;
  w_shaped: Record<string, number>;
}

export interface BuyerJourneyReport {
  contact_id: string;
  milestones: { name: string; date: string; elapsed_days: number }[];
  total_cycle_days: number;
  critical_delay_points: string[];
}

class CrmIntelligenceService {
  /**
   * Identifies competitor presence and structures hyper-effective positioning counters.
   */
  async generateCompetitiveStrategy(
    competitorName: string
  ): Promise<CompetitorInsight> {
    const defaultPlaybooks: Record<string, CompetitorInsight> = {
      salesforce: {
        competitor_name: 'Salesforce',
        strength: 'Deep enterprise ecosystem and comprehensive custom reporting layouts',
        weakness: 'Prohibitively high licensing costs, slow deployment cycles, and steep training curve',
        positioning_playbook: [
          'Highlight AlphaClone’s single-day setup and out-of-the-box AI workflows.',
          'Lead with transparent workspace pricing and a free tier to contrast with Salesforce per-seat overhead.',
        ]
      },
      hubspot: {
        competitor_name: 'HubSpot',
        strength: 'Highly intuitive user interfaces and polished inbound marketing templates',
        weakness: 'Extremely aggressive price escalation on contact tiers and limited background agent autonomy',
        positioning_playbook: [
          'Demonstrate AlphaClone’s sovereign Claude/Grok background agent fleet running automated research.',
          'Leverage AlphaClone’s flat contact pricing models to neutralize HubSpot’s contact-scaling penalties.'
        ]
      }
    };

    const key = competitorName.toLowerCase().trim();
    if (defaultPlaybooks[key]) {
      return defaultPlaybooks[key]!;
    }

    return {
      competitor_name: competitorName,
      strength: 'Generic competitive presence and broad market recognition',
      weakness: 'Higher pricing models and lack of specialized local GIS/autonomous lead gathering',
      positioning_playbook: [
        'Highlight AlphaClone’s native multi-source scraper (OSM + HERE) and multi-channel publication autopilot.',
        'Contrast custom Wyoming regulatory CCPA scanning triggers with the competitor’s generic template designs.'
      ]
    };
  }

  /**
   * Computes Multi-Touch Attribution models (First-Touch, Last-Touch, Linear, W-Shaped)
   * to determine value allocation across marketing channels.
   */
  async computeMarketingAttribution(
    supabase: SupabaseClient,
    tenantId: string
  ): Promise<AttributionReport> {
    // 1. Fetch leads with attribution metadata
    const { data: leads } = await supabase
      .from('leads')
      .select('id, lead_source, metadata, created_at')
      .eq('tenant_id', tenantId);

    const firstTouch: Record<string, number> = {};
    const lastTouch: Record<string, number> = {};
    const linear: Record<string, number> = {};
    const wShaped: Record<string, number> = {};

    const leadList = Array.isArray(leads) ? leads : [];

    for (const lead of leadList) {
      const primarySource = lead.lead_source || 'direct';

      // Parse simulated touchpoints from metadata or fallback to standard source
      const metadata = lead.metadata as Record<string, any> | null;
      const touchpoints: Touchpoint[] = (metadata?.touchpoints as Touchpoint[]) || [
        { channel: primarySource, timestamp: lead.created_at, asset: 'Landing Page' }
      ];

      const len = touchpoints.length;
      if (len === 0) continue;

      // First-Touch Model
      const ftChannel = touchpoints[0]!.channel;
      firstTouch[ftChannel] = (firstTouch[ftChannel] || 0) + 1;

      // Last-Touch Model
      const ltChannel = touchpoints[len - 1]!.channel;
      lastTouch[ltChannel] = (lastTouch[ltChannel] || 0) + 1;

      // Linear Model: Distribute 1 credit equally
      touchpoints.forEach(tp => {
        linear[tp.channel] = (linear[tp.channel] || 0) + 1 / len;
      });

      // W-Shaped Model: 30% first, 30% middle interactions, 30% last, 10% remaining
      if (len === 1) {
        wShaped[ftChannel] = (wShaped[ftChannel] || 0) + 1;
      } else if (len === 2) {
        wShaped[ftChannel] = (wShaped[ftChannel] || 0) + 0.5;
        wShaped[ltChannel] = (wShaped[ltChannel] || 0) + 0.5;
      } else {
        wShaped[ftChannel] = (wShaped[ftChannel] || 0) + 0.3;
        wShaped[ltChannel] = (wShaped[ltChannel] || 0) + 0.3;

        const middleWeight = 0.4 / (len - 2);
        for (let i = 1; i < len - 1; i++) {
          const midChannel = touchpoints[i]!.channel;
          wShaped[midChannel] = (wShaped[midChannel] || 0) + middleWeight;
        }
      }
    }

    const roundStats = (record: Record<string, number>) => {
      const rounded: Record<string, number> = {};
      Object.keys(record).forEach(k => {
        rounded[k] = Math.round(record[k]! * 100) / 100;
      });
      return rounded;
    };

    return {
      first_touch: roundStats(firstTouch),
      last_touch: roundStats(lastTouch),
      linear: roundStats(linear),
      w_shaped: roundStats(wShaped)
    };
  }

  /**
   * Analyzes conversion velocities and delay checkpoints along the buyer's pipeline journey.
   */
  async analyzeBuyerJourney(
    supabase: SupabaseClient,
    tenantId: string,
    contactId: string
  ): Promise<BuyerJourneyReport> {
    const milestones: { name: string; date: string; elapsed_days: number }[] = [];
    const delays: string[] = [];

    // Fetch chronological messages, emails, and events for timing logs
    const { data: messages } = await supabase
      .from('messages')
      .select('created_at, priority')
      .eq('tenant_id', tenantId)
      .or(`sender_id.eq.${contactId},recipient_id.eq.${contactId}`)
      .order('created_at', { ascending: true });

    const msgList = Array.isArray(messages) ? messages : [];

    if (msgList.length > 0) {
      const start = new Date(msgList[0]!.created_at);
      milestones.push({
        name: 'First Interaction',
        date: msgList[0]!.created_at,
        elapsed_days: 0
      });

      let prevTime = start;

      for (let i = 1; i < msgList.length; i++) {
        const currTime = new Date(msgList[i]!.created_at);
        const diffDays = Math.floor((currTime.getTime() - prevTime.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays > 14) {
          delays.push(`Friction delay between message ${i} and ${i + 1}: Silent for ${diffDays} days`);
        }

        prevTime = currTime;
      }

      const totalDays = Math.floor((prevTime.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      milestones.push({
        name: 'Latest Activity Checkpoint',
        date: prevTime.toISOString(),
        elapsed_days: totalDays
      });

      return {
        contact_id: contactId,
        milestones,
        total_cycle_days: totalDays,
        critical_delay_points: delays
      };
    }

    return {
      contact_id: contactId,
      milestones: [],
      total_cycle_days: 0,
      critical_delay_points: []
    };
  }
}

export const crmIntelligenceService = new CrmIntelligenceService();
