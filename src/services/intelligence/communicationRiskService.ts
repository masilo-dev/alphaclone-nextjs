import type { SupabaseClient } from '@supabase/supabase-js';

export interface CommunicationMetrics {
  deal_id: string;
  last_interaction_date: string | null;
  silent_days: number;
  total_messages_exchanged: number;
  outbound_count: number;
  inbound_count: number;
  initiator_ratio: number; // inbound / outbound ratio
  avg_outbound_length: number;
  avg_inbound_length: number;
  length_ratio: number; // avg_inbound_length / avg_outbound_length
  avg_response_delay_hours: number;
  sentiment_trend: 'improving' | 'stable' | 'declining' | 'unknown';
}

export interface CommunicationRiskReport {
  deal_id: string;
  risk_score: number; // 0 to 100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  metrics: CommunicationMetrics;
  recommended_actions: string[];
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

class CommunicationRiskService {
  /**
   * Analyze communication patterns for a deal to predict risk.
   * Examines response time drift, message length ratios, initiator imbalance, and silent streaks.
   */
  async analyzeDealRisk(
    supabase: SupabaseClient,
    tenantId: string,
    dealId: string
  ): Promise<CommunicationRiskReport> {
    const now = Date.now();
    const factors: string[] = [];
    const recommended_actions: string[] = [];

    // 1. Fetch deal details
    const { data: deal } = await supabase
      .from('deals')
      .select('id, name, stage, contact_id, value')
      .eq('id', dealId)
      .eq('tenant_id', tenantId)
      .single();

    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    // 2. Fetch all messages/communications related to this deal's contact
    const contactId = deal.contact_id;
    let messages: any[] = [];

    if (contactId) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, content, sender_id, created_at, metadata')
        .eq('tenant_id', tenantId)
        .or(`sender_id.eq.${contactId},recipient_id.eq.${contactId}`)
        .order('created_at', { ascending: true });
      messages = Array.isArray(msgs) ? msgs : [];
    }

    // Calculate metrics
    let lastInteractionDate: string | null = null;
    let silentDays = 999;
    const total = messages.length;
    let outbound = 0;
    let inbound = 0;
    let totalInboundLen = 0;
    let totalOutboundLen = 0;
    let totalDelayMs = 0;
    let responseCount = 0;

    if (total > 0) {
      const lastMsg = messages[messages.length - 1];
      lastInteractionDate = lastMsg.created_at;
      silentDays = Math.max(0, Math.floor((now - new Date(lastMsg.created_at).getTime()) / (1000 * 60 * 60 * 24)));

      let prevMsg: any = null;

      for (const msg of messages) {
        const content = String(msg.content || '');
        const isOutbound = msg.sender_id !== contactId;

        if (isOutbound) {
          outbound++;
          totalOutboundLen += content.length;
        } else {
          inbound++;
          totalInboundLen += content.length;
        }

        // Response delay tracking
        if (prevMsg) {
          const prevTime = new Date(prevMsg.created_at).getTime();
          const currTime = new Date(msg.created_at).getTime();
          const delay = currTime - prevTime;

          // Only track if direction changed (e.g. prospect responding to us or vice versa)
          const prevIsOutbound = prevMsg.sender_id !== contactId;
          if (prevIsOutbound !== isOutbound && delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) {
            totalDelayMs += delay;
            responseCount++;
          }
        }
        prevMsg = msg;
      }
    }

    const initiatorRatio = outbound > 0 ? round2(inbound / outbound) : 0;
    const avgOutboundLength = outbound > 0 ? round2(totalOutboundLen / outbound) : 0;
    const avgInboundLength = inbound > 0 ? round2(totalInboundLen / inbound) : 0;
    const lengthRatio = avgOutboundLength > 0 ? round2(avgInboundLength / avgOutboundLength) : 0;
    const avgResponseDelayHours = responseCount > 0 ? round2(totalDelayMs / responseCount / (1000 * 60 * 60)) : 0;

    // Detect simple sentiment trend from last few messages
    let sentimentTrend: 'improving' | 'stable' | 'declining' | 'unknown' = 'unknown';
    const recentInbound = messages
      .filter(m => m.sender_id === contactId)
      .slice(-5);

    if (recentInbound.length >= 2) {
      const negativeWords = ['delay', 'wait', 'unhappy', 'expensive', 'cancel', 'stop', 'busy', 'later', 'budget', 'sorry'];
      const positiveWords = ['great', 'excited', 'thanks', 'perfect', 'awesome', 'yes', 'proceed', 'schedule', 'send'];

      const scores = recentInbound.map(m => {
        const text = String(m.content || '').toLowerCase();
        let s = 0;
        positiveWords.forEach(w => { if (text.includes(w)) s += 1; });
        negativeWords.forEach(w => { if (text.includes(w)) s -= 1; });
        return s;
      });

      const firstHalf = scores.slice(0, Math.floor(scores.length / 2)).reduce((a, b) => a + b, 0);
      const secondHalf = scores.slice(Math.floor(scores.length / 2)).reduce((a, b) => a + b, 0);

      if (secondHalf < firstHalf - 1) sentimentTrend = 'declining';
      else if (secondHalf > firstHalf + 1) sentimentTrend = 'improving';
      else sentimentTrend = 'stable';
    }

    // Risk calculation logic
    let riskScore = 15; // Base conversational risk

    if (silentDays > 30) {
      riskScore += 45;
      factors.push(`Stale communication: Zero messages in the last ${silentDays} days`);
    } else if (silentDays > 14) {
      riskScore += 30;
      factors.push(`Communication gap: Silent for ${silentDays} days`);
    } else if (silentDays > 7) {
      riskScore += 15;
      factors.push(`Minor fade: No interaction in over a week`);
    }

    if (initiatorRatio < 0.3 && total > 5) {
      riskScore += 20;
      factors.push(`Outreach imbalance: You are doing ${Math.round((1 - initiatorRatio) * 100)}% of the communication`);
    }

    if (lengthRatio < 0.2 && avgOutboundLength > 100) {
      riskScore += 15;
      factors.push('Low prospect engagement: Short inbound replies compared to long outbound pitches');
    }

    if (avgResponseDelayHours > 48) {
      riskScore += 15;
      factors.push(`Delayed responses: Prospect takes an average of ${Math.round(avgResponseDelayHours)} hours to reply`);
    }

    if (sentimentTrend === 'declining') {
      riskScore += 20;
      factors.push('Declining sentiment: Language indicates increasing friction or objections');
    }

    riskScore = clamp(riskScore, 5, 95);

    // Risk tiers
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (riskScore >= 75) riskLevel = 'critical';
    else if (riskScore >= 55) riskLevel = 'high';
    else if (riskScore >= 35) riskLevel = 'medium';

    // Build tactical recommended actions
    if (silentDays > 10) {
      recommended_actions.push('Trigger a "Pattern Interrupt" outreach: send a high-value checklist or industry resource completely unrelated to the direct pitch.');
    }
    if (initiatorRatio < 0.3) {
      recommended_actions.push('Pause outbound messaging walls: ask a single low-friction open-ended question (e.g. "Have you had a chance to look at this?") rather than detailed follow-ups.');
    }
    if (sentimentTrend === 'declining') {
      recommended_actions.push('Schedule a verbal alignment call immediately to directly address potential pricing or technical objections.');
    }
    if (recommended_actions.length === 0) {
      recommended_actions.push('Maintain current communication frequency. Keep message lengths balanced.');
    }

    const metrics: CommunicationMetrics = {
      deal_id: dealId,
      last_interaction_date: lastInteractionDate,
      silent_days: silentDays === 999 ? -1 : silentDays,
      total_messages_exchanged: total,
      outbound_count: outbound,
      inbound_count: inbound,
      initiator_ratio: initiatorRatio,
      avg_outbound_length: avgOutboundLength,
      avg_inbound_length: avgInboundLength,
      length_ratio: lengthRatio,
      avg_response_delay_hours: avgResponseDelayHours,
      sentiment_trend: sentimentTrend
    };

    return {
      deal_id: dealId,
      risk_score: round2(riskScore),
      risk_level: riskLevel,
      factors,
      metrics,
      recommended_actions
    };
  }
}

export const communicationRiskService = new CommunicationRiskService();
