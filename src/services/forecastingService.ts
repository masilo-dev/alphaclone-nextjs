import { supabase } from '../lib/supabase';

export interface SalesForecast {
    id: string;
    forecastPeriod: string;
    startDate: string;
    endDate: string;
    ownerId?: string;
    forecastedRevenue?: number;
    weightedPipelineValue?: number;
    actualRevenue: number;
    totalDeals: number;
    expectedWins: number;
    confidenceLevel?: number;
    notes?: string;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
}

export interface PerformanceMetric {
    id: string;
    metricName: string;
    metricValue: number;
    metricType: string;
    periodStart: string;
    periodEnd: string;
    userId?: string;
    targetValue?: number;
    metadata?: any;
    createdAt: string;
}

export interface SalesGoal {
    id: string;
    name: string;
    userId?: string;
    goalType: string;
    targetValue: number;
    currentValue: number;
    periodStart: string;
    periodEnd: string;
    isTeamGoal: boolean;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
}

export interface ForecastSummary {
    totalForecastedRevenue: number;
    totalWeightedPipeline: number;
    totalActualRevenue: number;
    achievementRate: number;
    totalDeals: number;
    expectedWins: number;
    averageConfidence: number;
}

export const forecastingService = {
    /**
     * Get all sales forecasts
     */
    async getForecasts(filters?: {
        ownerId?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<{ forecasts: SalesForecast[]; error: string | null }> {
        try {
            let query = supabase.from('sales_forecasts').select('*');

            if (filters?.ownerId) {
                query = query.eq('owner_id', filters.ownerId);
            }
            if (filters?.startDate) {
                query = query.gte('start_date', filters.startDate);
            }
            if (filters?.endDate) {
                query = query.lte('end_date', filters.endDate);
            }

            const { data, error } = await query.order('start_date', { ascending: false });

            if (error) throw error;

            const forecasts: SalesForecast[] = (data || []).map((f) => ({
                id: f.id,
                forecastPeriod: f.forecast_period,
                startDate: f.start_date,
                endDate: f.end_date,
                ownerId: f.owner_id,
                forecastedRevenue: f.forecasted_revenue,
                weightedPipelineValue: f.weighted_pipeline_value,
                actualRevenue: f.actual_revenue,
                totalDeals: f.total_deals,
                expectedWins: f.expected_wins,
                confidenceLevel: f.confidence_level,
                notes: f.notes,
                metadata: f.metadata || {},
                createdAt: f.created_at,
                updatedAt: f.updated_at,
            }));

            return { forecasts, error: null };
        } catch (err) {
            return { forecasts: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Create sales forecast
     */
    async createForecast(
        forecastData: {
            forecastPeriod: string;
            startDate: string;
            endDate: string;
            ownerId?: string;
            forecastedRevenue?: number;
            weightedPipelineValue?: number;
            totalDeals?: number;
            expectedWins?: number;
            confidenceLevel?: number;
            notes?: string;
        }
    ): Promise<{ forecast: SalesForecast | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('sales_forecasts')
                .insert({
                    forecast_period: forecastData.forecastPeriod,
                    start_date: forecastData.startDate,
                    end_date: forecastData.endDate,
                    owner_id: forecastData.ownerId,
                    forecasted_revenue: forecastData.forecastedRevenue,
                    weighted_pipeline_value: forecastData.weightedPipelineValue,
                    total_deals: forecastData.totalDeals || 0,
                    expected_wins: forecastData.expectedWins || 0,
                    confidence_level: forecastData.confidenceLevel,
                    notes: forecastData.notes,
                })
                .select()
                .single();

            if (error) throw error;

            const forecast: SalesForecast = {
                id: data.id,
                forecastPeriod: data.forecast_period,
                startDate: data.start_date,
                endDate: data.end_date,
                ownerId: data.owner_id,
                forecastedRevenue: data.forecasted_revenue,
                weightedPipelineValue: data.weighted_pipeline_value,
                actualRevenue: data.actual_revenue,
                totalDeals: data.total_deals,
                expectedWins: data.expected_wins,
                confidenceLevel: data.confidence_level,
                notes: data.notes,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { forecast, error: null };
        } catch (err) {
            return { forecast: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update sales forecast
     */
    async updateForecast(
        forecastId: string,
        updates: Partial<SalesForecast>
    ): Promise<{ forecast: SalesForecast | null; error: string | null }> {
        try {
            const updateData: any = {};

            if (updates.forecastedRevenue !== undefined) updateData.forecasted_revenue = updates.forecastedRevenue;
            if (updates.weightedPipelineValue !== undefined) updateData.weighted_pipeline_value = updates.weightedPipelineValue;
            if (updates.actualRevenue !== undefined) updateData.actual_revenue = updates.actualRevenue;
            if (updates.totalDeals !== undefined) updateData.total_deals = updates.totalDeals;
            if (updates.expectedWins !== undefined) updateData.expected_wins = updates.expectedWins;
            if (updates.confidenceLevel !== undefined) updateData.confidence_level = updates.confidenceLevel;
            if (updates.notes !== undefined) updateData.notes = updates.notes;

            const { data, error } = await supabase
                .from('sales_forecasts')
                .update(updateData)
                .eq('id', forecastId)
                .select()
                .single();

            if (error) throw error;

            const forecast: SalesForecast = {
                id: data.id,
                forecastPeriod: data.forecast_period,
                startDate: data.start_date,
                endDate: data.end_date,
                ownerId: data.owner_id,
                forecastedRevenue: data.forecasted_revenue,
                weightedPipelineValue: data.weighted_pipeline_value,
                actualRevenue: data.actual_revenue,
                totalDeals: data.total_deals,
                expectedWins: data.expected_wins,
                confidenceLevel: data.confidence_level,
                notes: data.notes,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { forecast, error: null };
        } catch (err) {
            return { forecast: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete sales forecast
     */
    async deleteForecast(forecastId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase.from('sales_forecasts').delete().eq('id', forecastId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get forecast summary
     */
    async getForecastSummary(startDate?: string, endDate?: string): Promise<{ summary: ForecastSummary; error: string | null }> {
        try {
            let query = supabase.from('sales_forecasts').select('*');

            if (startDate) {
                query = query.gte('start_date', startDate);
            }
            if (endDate) {
                query = query.lte('end_date', endDate);
            }

            const { data, error } = await query;

            if (error) throw error;

            const summary: ForecastSummary = (data || []).reduce(
                (acc, f) => ({
                    totalForecastedRevenue: acc.totalForecastedRevenue + (f.forecasted_revenue || 0),
                    totalWeightedPipeline: acc.totalWeightedPipeline + (f.weighted_pipeline_value || 0),
                    totalActualRevenue: acc.totalActualRevenue + (f.actual_revenue || 0),
                    achievementRate: 0, // Will calculate after
                    totalDeals: acc.totalDeals + (f.total_deals || 0),
                    expectedWins: acc.expectedWins + (f.expected_wins || 0),
                    averageConfidence: acc.averageConfidence + (f.confidence_level || 0),
                }),
                {
                    totalForecastedRevenue: 0,
                    totalWeightedPipeline: 0,
                    totalActualRevenue: 0,
                    achievementRate: 0,
                    totalDeals: 0,
                    expectedWins: 0,
                    averageConfidence: 0,
                }
            );

            // Calculate achievement rate and average confidence
            if (summary.totalForecastedRevenue > 0) {
                summary.achievementRate = (summary.totalActualRevenue / summary.totalForecastedRevenue) * 100;
            }
            if (data && data.length > 0) {
                summary.averageConfidence = summary.averageConfidence / data.length;
            }

            return { summary, error: null };
        } catch (err) {
            return {
                summary: {
                    totalForecastedRevenue: 0,
                    totalWeightedPipeline: 0,
                    totalActualRevenue: 0,
                    achievementRate: 0,
                    totalDeals: 0,
                    expectedWins: 0,
                    averageConfidence: 0,
                },
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    },

    /**
     * Get performance metrics
     */
    async getMetrics(filters?: {
        metricType?: string;
        userId?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<{ metrics: PerformanceMetric[]; error: string | null }> {
        try {
            let query = supabase.from('performance_metrics').select('*');

            if (filters?.metricType) {
                query = query.eq('metric_type', filters.metricType);
            }
            if (filters?.userId) {
                query = query.eq('user_id', filters.userId);
            }
            if (filters?.startDate) {
                query = query.gte('period_start', filters.startDate);
            }
            if (filters?.endDate) {
                query = query.lte('period_end', filters.endDate);
            }

            const { data, error } = await query.order('period_start', { ascending: false });

            if (error) throw error;

            const metrics: PerformanceMetric[] = (data || []).map((m) => ({
                id: m.id,
                metricName: m.metric_name,
                metricValue: m.metric_value,
                metricType: m.metric_type,
                periodStart: m.period_start,
                periodEnd: m.period_end,
                userId: m.user_id,
                targetValue: m.target_value,
                metadata: m.metadata || {},
                createdAt: m.created_at,
            }));

            return { metrics, error: null };
        } catch (err) {
            return { metrics: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Create performance metric
     */
    async createMetric(
        metricData: {
            metricName: string;
            metricValue: number;
            metricType: string;
            periodStart: string;
            periodEnd: string;
            userId?: string;
            targetValue?: number;
        }
    ): Promise<{ metric: PerformanceMetric | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('performance_metrics')
                .insert({
                    metric_name: metricData.metricName,
                    metric_value: metricData.metricValue,
                    metric_type: metricData.metricType,
                    period_start: metricData.periodStart,
                    period_end: metricData.periodEnd,
                    user_id: metricData.userId,
                    target_value: metricData.targetValue,
                })
                .select()
                .single();

            if (error) throw error;

            const metric: PerformanceMetric = {
                id: data.id,
                metricName: data.metric_name,
                metricValue: data.metric_value,
                metricType: data.metric_type,
                periodStart: data.period_start,
                periodEnd: data.period_end,
                userId: data.user_id,
                targetValue: data.target_value,
                metadata: data.metadata || {},
                createdAt: data.created_at,
            };

            return { metric, error: null };
        } catch (err) {
            return { metric: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get sales goals
     */
    async getGoals(filters?: {
        userId?: string;
        isTeamGoal?: boolean;
        active?: boolean;
    }): Promise<{ goals: SalesGoal[]; error: string | null }> {
        try {
            let query = supabase.from('sales_goals').select('*');

            if (filters?.userId) {
                query = query.eq('user_id', filters.userId);
            }
            if (filters?.isTeamGoal !== undefined) {
                query = query.eq('is_team_goal', filters.isTeamGoal);
            }
            if (filters?.active) {
                const today = new Date().toISOString().split('T')[0];
                query = query.lte('period_start', today).gte('period_end', today);
            }

            const { data, error } = await query.order('period_start', { ascending: false });

            if (error) throw error;

            const goals: SalesGoal[] = (data || []).map((g) => ({
                id: g.id,
                name: g.name,
                userId: g.user_id,
                goalType: g.goal_type,
                targetValue: g.target_value,
                currentValue: g.current_value,
                periodStart: g.period_start,
                periodEnd: g.period_end,
                isTeamGoal: g.is_team_goal,
                metadata: g.metadata || {},
                createdAt: g.created_at,
                updatedAt: g.updated_at,
            }));

            return { goals, error: null };
        } catch (err) {
            return { goals: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Create sales goal
     */
    async createGoal(
        goalData: {
            name: string;
            userId?: string;
            goalType: string;
            targetValue: number;
            periodStart: string;
            periodEnd: string;
            isTeamGoal?: boolean;
        }
    ): Promise<{ goal: SalesGoal | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('sales_goals')
                .insert({
                    name: goalData.name,
                    user_id: goalData.userId,
                    goal_type: goalData.goalType,
                    target_value: goalData.targetValue,
                    period_start: goalData.periodStart,
                    period_end: goalData.periodEnd,
                    is_team_goal: goalData.isTeamGoal || false,
                })
                .select()
                .single();

            if (error) throw error;

            const goal: SalesGoal = {
                id: data.id,
                name: data.name,
                userId: data.user_id,
                goalType: data.goal_type,
                targetValue: data.target_value,
                currentValue: data.current_value,
                periodStart: data.period_start,
                periodEnd: data.period_end,
                isTeamGoal: data.is_team_goal,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { goal, error: null };
        } catch (err) {
            return { goal: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update sales goal
     */
    async updateGoal(goalId: string, updates: Partial<SalesGoal>): Promise<{ goal: SalesGoal | null; error: string | null }> {
        try {
            const updateData: any = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.targetValue !== undefined) updateData.target_value = updates.targetValue;
            if (updates.currentValue !== undefined) updateData.current_value = updates.currentValue;

            const { data, error } = await supabase.from('sales_goals').update(updateData).eq('id', goalId).select().single();

            if (error) throw error;

            const goal: SalesGoal = {
                id: data.id,
                name: data.name,
                userId: data.user_id,
                goalType: data.goal_type,
                targetValue: data.target_value,
                currentValue: data.current_value,
                periodStart: data.period_start,
                periodEnd: data.period_end,
                isTeamGoal: data.is_team_goal,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { goal, error: null };
        } catch (err) {
            return { goal: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete sales goal
     */
    async deleteGoal(goalId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase.from('sales_goals').delete().eq('id', goalId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Calculate goal progress
     */
    async calculateGoalProgress(goalId: string): Promise<{ progress: number; error: string | null }> {
        try {
            const { data, error } = await supabase.from('sales_goals').select('target_value, current_value').eq('id', goalId).single();

            if (error) throw error;

            const progress = data.target_value > 0 ? (data.current_value / data.target_value) * 100 : 0;

            return { progress, error: null };
        } catch (err) {
            return { progress: 0, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },
};
