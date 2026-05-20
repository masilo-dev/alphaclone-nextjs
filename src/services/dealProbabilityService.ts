import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';

export interface Deal {
    id: string;
    name: string;
    client_id: string;
    value: number;
    stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
    probability: number; // 0-100
    expected_close_date: string;
    created_at: string;
    updated_at: string;
}

export interface ProbabilityFactors {
    stageMultiplier: number;
    engagementScore: number;
    timeInStage: number;
    budgetConfirmed: boolean;
    decisionMakerEngaged: boolean;
    competitorPresent: boolean;
}

export interface ForecastData {
    totalPipelineValue: number;
    weightedPipelineValue: number;
    expectedRevenue: number;
    deals: Deal[];
    byStage: Record<string, { count: number; value: number; probability: number }>;
}

export interface DealIntelligenceProfile {
    intelligenceScore: number;
    intelligenceConfidence: number;
    intelligenceState: Record<string, number>;
    intelligenceRecommendations: string[];
    psychologyProfile: string[];
}

const STAGE_PROBABILITIES: Record<string, number> = {
    lead: 10,
    qualified: 25,
    proposal: 50,
    negotiation: 75,
    closed_won: 100,
    closed_lost: 0,
};

class DealProbabilityService {
    private buildDealIntelligence(
        probability: number,
        factors: Partial<ProbabilityFactors>
    ): DealIntelligenceProfile {
        const normalized = Math.max(0, Math.min(100, probability));
        const probability01 = normalized / 100;
        const confidence = Math.max(
            0.25,
            Math.min(
                0.95,
                0.45 +
                    (factors.engagementScore !== undefined ? factors.engagementScore / 250 : 0) +
                    (factors.decisionMakerEngaged ? 0.15 : 0) -
                    (factors.competitorPresent ? 0.1 : 0)
            )
        );

        const recommendations: string[] = [];
        if (factors.decisionMakerEngaged) {
            recommendations.push('Prioritize decision-maker follow-up in the next business day.');
        } else {
            recommendations.push('Increase decision-maker coverage before advancing stage.');
        }
        if (factors.competitorPresent) {
            recommendations.push('Send competitive proof and differentiation evidence this week.');
        }
        if ((factors.timeInStage || 0) > 14) {
            recommendations.push('Deal has slowed in stage; run a stall-recovery conversation.');
        }

        const psychologyProfile: string[] = [];
        if (factors.budgetConfirmed) psychologyProfile.push('budget_aligned_buyer');
        if (factors.decisionMakerEngaged) psychologyProfile.push('executive_engagement_confirmed');
        if (factors.competitorPresent) psychologyProfile.push('status_quo_bias_risk');
        if (!psychologyProfile.length) psychologyProfile.push('limited_behavioral_signals');

        return {
            intelligenceScore: Number(normalized.toFixed(2)),
            intelligenceConfidence: Number(confidence.toFixed(2)),
            intelligenceState: {
                close: Number(probability01.toFixed(2)),
                delay: Number((Math.max(0, 0.7 - probability01)).toFixed(2)),
                lost: Number((Math.max(0, 1 - probability01 - 0.15)).toFixed(2))
            },
            intelligenceRecommendations: recommendations,
            psychologyProfile
        };
    }

    /**
     * Calculate deal probability based on multiple factors using Bayesian Posterior Probability Updates.
     *
     * P(Win | Signals) = P(Signals | Win) * P(Win) / P(Signals)
     * We start with a prior probability derived from the historical win-rate of the current stage,
     * then sequentially update the probability (prior -> posterior) for each observed signal E.
     *
     * Sequential update formula for independent signals:
     * Posterior Odds = Prior Odds * Bayes Factor
     * where Odds = P / (1 - P), and Bayes Factor = P(Signal | Win) / P(Signal | ~Win)
     */
    calculateProbability(deal: Deal, factors: Partial<ProbabilityFactors> = {}): number {
        // 1. Determine prior probability based on stage
        let prior = (STAGE_PROBABILITIES[deal.stage] || 0) / 100;

        // Perfect certainties (closed)
        if (deal.stage === 'closed_won') return 100;
        if (deal.stage === 'closed_lost') return 0;

        // Keep bounds away from absolute 0/1 to avoid mathematically collapsing the Bayesian system
        prior = Math.max(0.02, Math.min(0.98, prior));

        // 2. Define likelihood parameters P(E | Win) vs P(E | ~Win)
        interface Likelihood {
            pGivenWin: number;
            pGivenLose: number;
        }

        const updates: Likelihood[] = [];

        // Signal: Budget Confirmed
        if (factors.budgetConfirmed !== undefined) {
            if (factors.budgetConfirmed) {
                updates.push({ pGivenWin: 0.85, pGivenLose: 0.35 });
            } else {
                updates.push({ pGivenWin: 0.15, pGivenLose: 0.65 });
            }
        }

        // Signal: Decision Maker Engaged
        if (factors.decisionMakerEngaged !== undefined) {
            if (factors.decisionMakerEngaged) {
                updates.push({ pGivenWin: 0.90, pGivenLose: 0.40 });
            } else {
                updates.push({ pGivenWin: 0.10, pGivenLose: 0.60 });
            }
        }

        // Signal: Competitor Present
        if (factors.competitorPresent !== undefined) {
            if (factors.competitorPresent) {
                // Competitor presence lowers closing probability
                updates.push({ pGivenWin: 0.25, pGivenLose: 0.60 });
            } else {
                updates.push({ pGivenWin: 0.75, pGivenLose: 0.40 });
            }
        }

        // Signal: Engagement Score
        if (factors.engagementScore !== undefined) {
            const score = factors.engagementScore;
            if (score >= 75) {
                // High engagement
                updates.push({ pGivenWin: 0.80, pGivenLose: 0.30 });
            } else if (score < 30) {
                // Low engagement
                updates.push({ pGivenWin: 0.15, pGivenLose: 0.55 });
            } else {
                // Neutral engagement
                updates.push({ pGivenWin: 0.50, pGivenLose: 0.50 });
            }
        }

        // Signal: Time In Stage (Stalling)
        if (factors.timeInStage !== undefined) {
            const days = factors.timeInStage;
            if (days > 60) {
                // Major stall
                updates.push({ pGivenWin: 0.10, pGivenLose: 0.65 });
            } else if (days > 30) {
                // Moderate stall
                updates.push({ pGivenWin: 0.25, pGivenLose: 0.50 });
            }
        }

        // 3. Sequentially calculate posterior odds and map back to probability
        let odds = prior / (1 - prior);

        for (const signal of updates) {
            const bayesFactor = signal.pGivenWin / signal.pGivenLose;
            odds = odds * bayesFactor;
        }

        // Convert odds back to probability: P = Odds / (1 + Odds)
        let posterior = odds / (1 + odds);

        // Map back to 0-100 percentage scale and clamp
        return Math.max(1, Math.min(99, Math.round(posterior * 100)));
    }


    /**
     * Update deal probability
     */
    async updateDealProbability(
        dealId: string,
        factors: Partial<ProbabilityFactors>
    ): Promise<{ success: boolean; probability?: number; error?: string }> {
        try {
            const { data: deal } = await supabase
                .from('deals')
                .select('*')
                .eq('id', dealId)
                .single();

            if (!deal) {
                return { success: false, error: 'Deal not found' };
            }

            const newProbability = this.calculateProbability(deal, factors);
            const intelligence = this.buildDealIntelligence(newProbability, factors);

            const { error } = await supabase
                .from('deals')
                .update({
                    probability: newProbability,
                    intelligence_score: intelligence.intelligenceScore,
                    intelligence_confidence: intelligence.intelligenceConfidence,
                    intelligence_state: intelligence.intelligenceState,
                    intelligence_recommendations: intelligence.intelligenceRecommendations,
                    psychology_profile: intelligence.psychologyProfile,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', dealId);

            if (error) {
                return { success: false, error: error.message };
            }

            // Log probability change
            await auditLoggingService.logAction(
                'deal_probability_updated',
                'deal',
                dealId,
                { probability: deal.probability },
                { probability: newProbability, factors }
            );

            return { success: true, probability: newProbability };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Get sales forecast
     */
    async getSalesForecast(
        startDate?: Date,
        endDate?: Date
    ): Promise<ForecastData> {
        try {
            let query = supabase
                .from('deals')
                .select('*')
                .not('stage', 'in', '(closed_won,closed_lost)');

            if (startDate) {
                query = query.gte('expected_close_date', startDate.toISOString());
            }
            if (endDate) {
                query = query.lte('expected_close_date', endDate.toISOString());
            }

            const { data: deals } = await query;

            if (!deals) {
                return this.getEmptyForecast();
            }

            const totalPipelineValue = (deals as any[]).reduce((sum: number, deal: any) => sum + deal.value, 0);
            const weightedPipelineValue = (deals as any[]).reduce(
                (sum: number, deal: any) => sum + deal.value * (deal.probability / 100),
                0
            );

            // Group by stage
            const byStage: Record<string, { count: number; value: number; probability: number }> = {};

            (deals as any[]).forEach((deal: any) => {
                if (!byStage[deal.stage]) {
                    byStage[deal.stage] = { count: 0, value: 0, probability: 0 };
                }
                byStage[deal.stage].count++;
                byStage[deal.stage].value += deal.value;
                byStage[deal.stage].probability = STAGE_PROBABILITIES[deal.stage];
            });

            return {
                totalPipelineValue,
                weightedPipelineValue,
                expectedRevenue: weightedPipelineValue,
                deals,
                byStage,
            };
        } catch (error) {
            console.error('Error generating sales forecast:', error);
            return this.getEmptyForecast();
        }
    }

    /**
     * Get deals by probability range
     */
    async getDealsByProbability(
        minProbability: number,
        maxProbability: number
    ): Promise<Deal[]> {
        try {
            const { data: deals } = await supabase
                .from('deals')
                .select('*')
                .gte('probability', minProbability)
                .lte('probability', maxProbability)
                .order('probability', { ascending: false });

            return deals || [];
        } catch (error) {
            console.error('Error fetching deals by probability:', error);
            return [];
        }
    }

    /**
     * Get at-risk deals (low probability, high value)
     */
    async getAtRiskDeals(): Promise<Deal[]> {
        try {
            const { data: deals } = await supabase
                .from('deals')
                .select('*')
                .lt('probability', 50)
                .gte('value', 10000)
                .not('stage', 'in', '(closed_won,closed_lost)')
                .order('value', { ascending: false });

            return deals || [];
        } catch (error) {
            console.error('Error fetching at-risk deals:', error);
            return [];
        }
    }

    /**
     * Get hot deals (high probability, closing soon)
     */
    async getHotDeals(): Promise<Deal[]> {
        try {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            const { data: deals } = await supabase
                .from('deals')
                .select('*')
                .gte('probability', 70)
                .lte('expected_close_date', thirtyDaysFromNow.toISOString())
                .not('stage', 'in', '(closed_won,closed_lost)')
                .order('expected_close_date', { ascending: true });

            return deals || [];
        } catch (error) {
            console.error('Error fetching hot deals:', error);
            return [];
        }
    }

    /**
     * Calculate win rate
     */
    async calculateWinRate(startDate?: Date, endDate?: Date): Promise<number> {
        try {
            let query = supabase
                .from('deals')
                .select('stage')
                .in('stage', ['closed_won', 'closed_lost']);

            if (startDate) {
                query = query.gte('updated_at', startDate.toISOString());
            }
            if (endDate) {
                query = query.lte('updated_at', endDate.toISOString());
            }

            const { data: deals } = await query;

            if (!deals || deals.length === 0) {
                return 0;
            }

            const wonDeals = (deals as any[]).filter((d: any) => d.stage === 'closed_won').length;
            return (wonDeals / deals.length) * 100;
        } catch (error) {
            console.error('Error calculating win rate:', error);
            return 0;
        }
    }

    /**
     * Get average deal cycle time (days)
     */
    async getAverageDealCycle(): Promise<number> {
        try {
            const { data: deals } = await supabase
                .from('deals')
                .select('created_at, updated_at')
                .eq('stage', 'closed_won')
                .limit(50);

            if (!deals || deals.length === 0) {
                return 0;
            }

            const totalDays = (deals as any[]).reduce((sum: number, deal: any) => {
                const created = new Date(deal.created_at);
                const closed = new Date(deal.updated_at);
                const days = (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
                return sum + days;
            }, 0);

            return Math.round(totalDays / deals.length);
        } catch (error) {
            console.error('Error calculating average deal cycle:', error);
            return 0;
        }
    }

    /**
     * Auto-update probabilities based on stage changes
     */
    async autoUpdateProbabilities(): Promise<void> {
        try {
            const { data: deals } = await supabase
                .from('deals')
                .select('*')
                .not('stage', 'in', '(closed_won,closed_lost)');

            if (!deals) return;

            for (const deal of deals) {
                // Calculate time in current stage
                const updatedAt = new Date(deal.updated_at);
                const now = new Date();
                const daysInStage = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

                // Update probability based on time in stage
                const factors: Partial<ProbabilityFactors> = {
                    timeInStage: daysInStage,
                };

                await this.updateDealProbability(deal.id, factors);
            }
        } catch (error) {
            console.error('Error auto-updating probabilities:', error);
        }
    }

    /**
     * Get empty forecast structure
     */
    private getEmptyForecast(): ForecastData {
        return {
            totalPipelineValue: 0,
            weightedPipelineValue: 0,
            expectedRevenue: 0,
            deals: [],
            byStage: {},
        };
    }
}

export const dealProbabilityService = new DealProbabilityService();
