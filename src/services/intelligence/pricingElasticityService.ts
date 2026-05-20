import type { SupabaseClient } from '@supabase/supabase-js';

export interface PricingRecommendation {
  deal_id: string;
  original_value: number;
  recommended_value: number;
  discount_percentage: number;
  win_probability_impact: number;
  margin_impact: number;
  elasticity_reasoning: string;
}

class PricingElasticityService {
  /**
   * Recommends optimal deal pricing based on historical win rates across similar deal sizes
   * to maximize both the expected value (Probability × Deal Size) and closing rate.
   */
  async calculateOptimalDiscount(
    supabase: SupabaseClient,
    tenantId: string,
    dealId: string
  ): Promise<PricingRecommendation> {
    // 1. Fetch current deal details
    const { data: deal } = await supabase
      .from('deals')
      .select('id, value, stage, probability')
      .eq('id', dealId)
      .eq('tenant_id', tenantId)
      .single();

    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    const originalValue = Number(deal.value || 0);
    
    // 2. Fetch historical won deals to compute price elasticity in similar ranges
    // Look for deals within a +/- 30% value band
    const minBand = originalValue * 0.7;
    const maxBand = originalValue * 1.3;

    const { data: historicalDeals } = await supabase
      .from('deals')
      .select('value, stage, probability')
      .eq('tenant_id', tenantId)
      .gte('value', minBand)
      .lte('value', maxBand);

    const history = Array.isArray(historicalDeals) ? historicalDeals : [];
    
    let totalWon = 0;
    let totalLost = 0;
    
    history.forEach(d => {
      if (d.stage === 'closed_won') totalWon++;
      if (d.stage === 'closed_lost') totalLost++;
    });

    const historicalWinRate = totalWon + totalLost > 0 ? totalWon / (totalWon + totalLost) : 0.3;

    // Simple elasticity model: Every 5% discount yields a relative 15% boost in win probability (up to a cap)
    // We want to maximize Expected Value (EV = Price * Probability)
    let bestDiscount = 0;
    let maxEV = originalValue * historicalWinRate;
    let bestProbImpact = 0;

    for (let discount = 0; discount <= 0.25; discount += 0.05) {
      const discountedValue = originalValue * (1 - discount);
      const probBoostMultiplier = 1 + (discount * 3); // 5% discount -> 15% boost
      const newProb = Math.min(0.95, historicalWinRate * probBoostMultiplier);
      const newEV = discountedValue * newProb;

      if (newEV > maxEV) {
        maxEV = newEV;
        bestDiscount = discount;
        bestProbImpact = newProb - historicalWinRate;
      }
    }

    // Default to a strategic 10% discount if EV is generally flat but we want velocity
    if (bestDiscount === 0 && historicalWinRate < 0.4) {
      bestDiscount = 0.10;
      bestProbImpact = historicalWinRate * 0.3; // 30% relative boost
    }

    const recommendedValue = originalValue * (1 - bestDiscount);

    return {
      deal_id: dealId,
      original_value: originalValue,
      recommended_value: recommendedValue,
      discount_percentage: Math.round(bestDiscount * 100),
      win_probability_impact: Math.round(bestProbImpact * 100),
      margin_impact: -Math.round(bestDiscount * 100),
      elasticity_reasoning: `A ${Math.round(bestDiscount * 100)}% discount maximizes expected revenue, balancing a ${Math.round(bestProbImpact * 100)}% absolute boost in close probability against margin decay.`
    };
  }
}

export const pricingElasticityService = new PricingElasticityService();
