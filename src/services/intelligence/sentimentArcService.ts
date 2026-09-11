import type { SupabaseClient } from '@supabase/supabase-js';

export interface SentimentDataPoint {
  index: number;
  message_id: string;
  sender_name: string;
  created_at: string;
  score: number; // -1.0 to 1.0
  keywords: string[];
  friction_detected: boolean;
}

export interface SentimentArcReport {
  deal_id: string;
  points: SentimentDataPoint[];
  overall_trend: 'improving' | 'stable' | 'declining' | 'unknown';
  average_score: number;
  critical_objections: string[];
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

class SentimentArcService {
  /**
   * Tracks and analyzes sequential customer interactions over time to draw
   * a chronological sentiment arc, detecting objections and frictional anomalies.
   */
  async analyzeSentimentArc(
    supabase: SupabaseClient,
    tenantId: string,
    dealId: string
  ): Promise<SentimentArcReport> {
    const points: SentimentDataPoint[] = [];
    const criticalObjections: string[] = [];

    // 1. Fetch deal details
    const { data: deal } = await supabase
      .from('deals')
      .select('contact_id')
      .eq('id', dealId)
      .eq('tenant_id', tenantId)
      .single();

    if (!deal || !deal.contact_id) {
      return { deal_id: dealId, points: [], overall_trend: 'unknown', average_score: 0, critical_objections: [] };
    }

    // 2. Fetch all messages related to this contact
    const { data: messages } = await supabase
      .from('messages')
      .select('id, content, sender_id, sender_name, created_at')
      .eq('tenant_id', tenantId)
      .or(`sender_id.eq.${deal.contact_id},recipient_id.eq.${deal.contact_id}`)
      .order('created_at', { ascending: true })
      .limit(30);

    const messageList = Array.isArray(messages) ? messages : [];

    const positiveWords = ['thanks', 'great', 'excited', 'yes', 'perfect', 'awesome', 'proceed', 'schedule', 'send', 'love'];
    const negativeWords = ['delay', 'wait', 'unhappy', 'expensive', 'cancel', 'stop', 'busy', 'later', 'budget', 'sorry', 'concern', 'worry'];

    let totalScore = 0;
    let pointIndex = 1;

    for (const msg of messageList) {
      const text = String(msg.content || '').toLowerCase();
      const isOutbound = msg.sender_id !== deal.contact_id;

      // Only measure sentiment on inbound prospect messages
      if (isOutbound) continue;

      let score = 0.05; // standard slightly positive neutral baseline
      const keywords: string[] = [];
      let friction = false;

      positiveWords.forEach(w => {
        if (text.includes(w)) {
          score += 0.25;
          keywords.push(w);
        }
      });

      negativeWords.forEach(w => {
        if (text.includes(w)) {
          score -= 0.35;
          keywords.push(w);
          friction = true;
          if (!criticalObjections.includes(w)) {
            criticalObjections.push(w);
          }
        }
      });

      // Clamp score
      score = Math.max(-1.0, Math.min(1.0, score));
      totalScore += score;

      points.push({
        index: pointIndex++,
        message_id: msg.id,
        sender_name: msg.sender_name || 'Prospect',
        created_at: msg.created_at,
        score: round2(score),
        keywords,
        friction_detected: friction
      });
    }

    // 3. Compute overall trajectory trend
    let trend: 'improving' | 'stable' | 'declining' | 'unknown' = 'unknown';

    if (points.length >= 2) {
      const half = Math.floor(points.length / 2);
      const firstAvg = points.slice(0, half).reduce((sum, p) => sum + p.score, 0) / half;
      const secondAvg = points.slice(half).reduce((sum, p) => sum + p.score, 0) / (points.length - half);

      if (secondAvg > firstAvg + 0.15) {
        trend = 'improving';
      } else if (secondAvg < firstAvg - 0.15) {
        trend = 'declining';
      } else {
        trend = 'stable';
      }
    }

    const averageScore = points.length > 0 ? totalScore / points.length : 0;

    return {
      deal_id: dealId,
      points,
      overall_trend: trend,
      average_score: round2(averageScore),
      critical_objections: criticalObjections
    };
  }
}

export const sentimentArcService = new SentimentArcService();
