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

const STAGE_PROBABILITIES: Record<string, number> = {
    lead: 10,
    qualified: 25,
    proposal: 50,
    negotiation: 75,
    closed_won: 100,
    closed_lost: 0,
};

class DealProbabilityService {
    /**
     * Calculate deal probability based on multiple factors
     */
    calculateProbability(deal: Deal, factors: Partial<ProbabilityFactors> = {}): number {
        // Base probability from stage
        let probability = STAGE_PROBABILITIES[deal.stage] || 0;

        // Adjust based on engagement score (0-100)
        if (factors.engagementScore !== undefined) {
            const engagementAdjustment = (factors.engagementScore - 50) * 0.2;
            probability += engagementAdjustment;
        }

        // Adjust based on time in stage (days)
        if (factors.timeInStage !== undefined) {
            // Deals that linger too long have lower probability
            if (factors.timeInStage > 30) {
                probability -= 10;
            } else if (factors.timeInStage > 60) {
                probability -= 20;
            }
        }

        // Boost if budget is confirmed
        if (factors.budgetConfirmed) {
            probability += 10;
        }

        // Boost if decision maker is engaged
        if (factors.decisionMakerEngaged) {
            probability += 15;
        }

        // Reduce if competitor is present
        if (factors.competitorPresent) {
            probability -= 15;
        }

        // Clamp between 0 and 100
        return Math.max(0, Math.min(100, probability));
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

            const { error } = await supabase
                .from('deals')
                .update({
                    probability: newProbability,
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

            const totalPipelineValue = deals.reduce((sum, deal) => sum + deal.value, 0);
            const weightedPipelineValue = deals.reduce(
                (sum, deal) => sum + deal.value * (deal.probability / 100),
                0
            );

            // Group by stage
            const byStage: Record<string, { count: number; value: number; probability: number }> = {};

            deals.forEach(deal => {
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

            const wonDeals = deals.filter(d => d.stage === 'closed_won').length;
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

            const totalDays = deals.reduce((sum, deal) => {
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
