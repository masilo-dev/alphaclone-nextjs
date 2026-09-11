import type { SupabaseClient } from '@supabase/supabase-js';

export type OutreachStrategy = 'ROI_FOCUS' | 'PROBLEM_SOLVER' | 'CASUAL_INTRO';

export interface StrategyBanditState {
  strategy: OutreachStrategy;
  attempts: number;
  successes: number;
  conversion_rate: number;
  alpha: number; // successes + 1
  beta: number; // attempts - successes + 1
}

class OutreachBanditService {
  /**
   * Implements Thompson Sampling (Bayesian Multi-Armed Bandit) to dynamically select
   * the highest-converting outreach strategy based on historical responses.
   */
  async selectBestStrategy(
    supabase: SupabaseClient,
    tenantId: string
  ): Promise<{ selected_strategy: OutreachStrategy; bandit_states: StrategyBanditState[] }> {
    // 1. Fetch historical conversion statistics for the tenant
    const { data: stats } = await supabase
      .from('outreach_campaign_stats')
      .select('strategy, sent_count, response_count')
      .eq('tenant_id', tenantId);

    const statList = Array.isArray(stats) ? stats : [];

    const strategies: OutreachStrategy[] = ['ROI_FOCUS', 'PROBLEM_SOLVER', 'CASUAL_INTRO'];
    const banditStates: StrategyBanditState[] = [];

    // 2. Initialize Beta distribution parameters (α, β) for each strategy
    for (const strat of strategies) {
      const entry = statList.find(s => s.strategy === strat);
      const attempts = Number(entry?.sent_count || 0);
      const successes = Number(entry?.response_count || 0);

      // Prior parameters: α = successes + 1, β = attempts - successes + 1
      const alpha = successes + 1.5;
      const beta = Math.max(1, attempts - successes) + 1.5;

      banditStates.push({
        strategy: strat,
        attempts,
        successes,
        conversion_rate: attempts > 0 ? successes / attempts : 0,
        alpha,
        beta
      });
    }

    // 3. Draw a sample from Beta(α, β) for each strategy (Thompson Sampling)
    let bestStrategy: OutreachStrategy = 'PROBLEM_SOLVER';
    let highestSampleValue = -1;

    for (const state of banditStates) {
      const sample = this.sampleBetaDistribution(state.alpha, state.beta);
      if (sample > highestSampleValue) {
        highestSampleValue = sample;
        bestStrategy = state.strategy;
      }
    }

    return {
      selected_strategy: bestStrategy,
      bandit_states: banditStates
    };
  }

  /**
   * Records a reward (conversion or attempt) to update the bandit's prior states.
   */
  async recordOutreachOutcome(
    supabase: SupabaseClient,
    tenantId: string,
    strategy: OutreachStrategy,
    responded: boolean
  ): Promise<void> {
    try {
      // Fetch existing record
      const { data: existing } = await supabase
        .from('outreach_campaign_stats')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('strategy', strategy)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('outreach_campaign_stats')
          .update({
            sent_count: existing.sent_count + 1,
            response_count: existing.response_count + (responded ? 1 : 0),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('outreach_campaign_stats')
          .insert({
            tenant_id: tenantId,
            strategy,
            sent_count: 1,
            response_count: responded ? 1 : 0,
            updated_at: new Date().toISOString()
          });
      }
    } catch {
      // Safe fallback if campaign_stats table is not yet created in the DB
    }
  }

  /**
   * Generates a random sample from a Beta distribution using Gamma distribution parameters.
   */
  private sampleBetaDistribution(alpha: number, beta: number): number {
    const x = this.sampleGammaDistribution(alpha, 1);
    const y = this.sampleGammaDistribution(beta, 1);
    return x + y > 0 ? x / (x + y) : 0;
  }

  /**
   * Generates a random sample from a Gamma distribution using Marsaglia and Tsang method.
   */
  private sampleGammaDistribution(k: number, theta: number): number {
    if (k < 1) {
      return this.sampleGammaDistribution(k + 1, theta) * Math.pow(Math.random(), 1 / k);
    }

    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let u = Math.random();
      let v = Math.random();
      let z = this.randomNormal();
      let w = 1 + c * z;

      if (w <= 0) continue;

      const vVal = w * w * w;
      if (u < 1 - 0.0331 * z * z * z * z) {
        return d * vVal * theta;
      }

      if (Math.log(u) < 0.5 * z * z + d * (1 - vVal + Math.log(vVal))) {
        return d * vVal * theta;
      }
    }
  }

  /**
   * Box-Muller transform for standard normal distribution sampling.
   */
  private randomNormal(): number {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); 
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}

export const outreachBanditService = new OutreachBanditService();
