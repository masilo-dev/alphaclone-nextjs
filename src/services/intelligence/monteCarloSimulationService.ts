import type { SupabaseClient } from '@supabase/supabase-js';

export interface SimulationResult {
  trials_run: number;
  pessimistic_forecast: number; // 10th percentile
  median_forecast: number; // 50th percentile
  optimistic_forecast: number; // 90th percentile
  mean_forecast: number;
  standard_deviation: number;
  probability_of_reaching_target: number; // Probability of exceeding targetValue
  distribution: { range_start: number; range_end: number; count: number }[];
}

class MonteCarloSimulationService {
  /**
   * Run a Monte Carlo simulation (1,000 trials) over the active deal pipeline
   * to calculate probabilistic forecasts and variance bounds.
   */
  async runPipelineSimulation(
    supabase: SupabaseClient,
    tenantId: string,
    targetValue: number = 25000,
    trials: number = 1000
  ): Promise<SimulationResult> {
    // 1. Fetch active deals for the tenant
    const { data: deals } = await supabase
      .from('deals')
      .select('id, value, probability')
      .eq('tenant_id', tenantId)
      .not('stage', 'in', '(closed_won,closed_lost)');

    const activeDeals = Array.isArray(deals) ? deals : [];

    if (activeDeals.length === 0) {
      return {
        trials_run: trials,
        pessimistic_forecast: 0,
        median_forecast: 0,
        optimistic_forecast: 0,
        mean_forecast: 0,
        standard_deviation: 0,
        probability_of_reaching_target: 0,
        distribution: []
      };
    }

    const trialResults: number[] = [];
    let targetsMet = 0;

    // 2. Execute trials
    for (let t = 0; t < trials; t++) {
      let trialTotal = 0;

      for (const deal of activeDeals) {
        const val = Number(deal.value || 0);
        // Base deal win probability (convert from 0-100 to 0-1 if necessary)
        const rawProb = Number(deal.probability || 30);
        const prob = rawProb > 1 ? rawProb / 100 : rawProb;

        // Perform random binomial trial
        if (Math.random() < prob) {
          trialTotal += val;
        }
      }

      trialResults.push(trialTotal);
      if (trialTotal >= targetValue) {
        targetsMet++;
      }
    }

    // Sort to extract percentiles
    trialResults.sort((a, b) => a - b);

    const pessimistic = trialResults[Math.floor(trials * 0.1)] || 0;
    const median = trialResults[Math.floor(trials * 0.5)] || 0;
    const optimistic = trialResults[Math.floor(trials * 0.9)] || 0;

    const sum = trialResults.reduce((a, b) => a + b, 0);
    const mean = sum / trials;

    const variance = trialResults.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / trials;
    const stdDev = Math.sqrt(variance);

    const probTarget = (targetsMet / trials) * 100;

    // 3. Compile distribution histogram (10 equal bins)
    const minVal = trialResults[0] || 0;
    const maxVal = trialResults[trialResults.length - 1] || 1;
    const step = (maxVal - minVal) / 10;
    const distribution: { range_start: number; range_end: number; count: number }[] = [];

    for (let i = 0; i < 10; i++) {
      const start = minVal + i * step;
      const end = start + step;
      const count = trialResults.filter(v => v >= start && v < end).length;

      distribution.push({
        range_start: Math.round(start),
        range_end: Math.round(end),
        count
      });
    }

    return {
      trials_run: trials,
      pessimistic_forecast: Math.round(pessimistic),
      median_forecast: Math.round(median),
      optimistic_forecast: Math.round(optimistic),
      mean_forecast: Math.round(mean),
      standard_deviation: Math.round(stdDev),
      probability_of_reaching_target: Math.round(probTarget * 100) / 100,
      distribution
    };
  }
}

export const monteCarloSimulationService = new MonteCarloSimulationService();
