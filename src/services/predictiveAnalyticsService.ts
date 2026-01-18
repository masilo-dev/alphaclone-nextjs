import { supabase } from '../lib/supabase';

export interface Prediction {
    type: 'completion_time' | 'revenue' | 'churn' | 'resource_demand' | 'budget_variance' | 'risk';
    value: number;
    confidence: number;
    factors: string[];
    timestamp: string;
}

export interface Forecast {
    period: string;
    value: number;
    lowerBound?: number;
    upperBound?: number;
}

export const predictiveAnalyticsService = {
    /**
     * Predict project completion time
     */
    async predictProjectCompletion(projectId: string): Promise<{ prediction: Prediction | null; error: string | null }> {
        try {
            const { data: project } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (!project) {
                return { prediction: null, error: 'Project not found' };
            }

            // Get historical project data
            const { data: historicalProjects } = await supabase
                .from('projects')
                .select('created_at, updated_at, status, category, progress')
                .eq('category', project.category)
                .eq('status', 'Completed')
                .limit(50);

            if (!historicalProjects || historicalProjects.length === 0) {
                return {
                    prediction: {
                        type: 'completion_time',
                        value: 30, // Default 30 days
                        confidence: 0.5,
                        factors: ['Insufficient historical data'],
                        timestamp: new Date().toISOString(),
                    },
                    error: null,
                };
            }

            // Calculate average completion time for similar projects
            const durations = historicalProjects
                .filter(p => p.created_at && p.updated_at)
                .map(p => {
                    const start = new Date(p.created_at);
                    const end = new Date(p.updated_at);
                    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                });

            const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
            const currentProgress = project.progress || 0;
            const remainingProgress = 100 - currentProgress;
            const estimatedDays = (avgDuration * remainingProgress) / 100;

            return {
                prediction: {
                    type: 'completion_time',
                    value: Math.ceil(estimatedDays),
                    confidence: 0.75,
                    factors: [
                        `Based on ${historicalProjects.length} similar completed projects`,
                        `Average completion time: ${Math.round(avgDuration)} days`,
                        `Current progress: ${currentProgress}%`,
                    ],
                    timestamp: new Date().toISOString(),
                },
                error: null,
            };
        } catch (error) {
            return {
                prediction: null,
                error: error instanceof Error ? error.message : 'Prediction failed',
            };
        }
    },

    /**
     * Forecast revenue
     */
    async forecastRevenue(forecastMonths: number = 6): Promise<{ forecast: Forecast[]; error: string | null }> {
        try {
            // Get historical revenue data
            const { data: invoices } = await supabase
                .from('invoices')
                .select('amount, created_at')
                .eq('status', 'Paid')
                .order('created_at', { ascending: false })
                .limit(12);

            if (!invoices || invoices.length < 3) {
                return {
                    forecast: [],
                    error: 'Insufficient historical data for forecasting',
                };
            }

            // Calculate monthly revenue
            const monthlyRevenue: Record<string, number> = {};
            invoices.forEach((inv: any) => {
                const month = new Date(inv.created_at).toISOString().substring(0, 7); // YYYY-MM
                monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (inv.amount || 0);
            });

            // Simple linear regression for forecasting
            const monthKeys = Object.keys(monthlyRevenue).sort();
            const values = monthKeys.map(m => monthlyRevenue[m] ?? 0);

            if (values.length < 2) {
                return { forecast: [], error: 'Insufficient data points' };
            }

            // Calculate trend
            const n = values.length;
            const sumX = (n * (n + 1)) / 2;
            const sumY = values.reduce((sum, v) => (sum ?? 0) + (v ?? 0), 0) ?? 0;
            const sumXY = values.reduce((sum, v, i) => (sum ?? 0) + (v ?? 0) * (i + 1), 0) ?? 0;
            const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            // Generate forecast
            const forecast: Forecast[] = [];
            const lastMonthStr = monthKeys[monthKeys.length - 1];
            if (!lastMonthStr) return { forecast: [], error: 'No data' };
            const lastMonth = new Date(lastMonthStr + '-01');
            const avgValue = sumY / n;
            const variance = values.reduce((sum, v) => (sum ?? 0) + Math.pow((v ?? 0) - avgValue, 2), 0) ?? 0 / n;
            const stdDev = Math.sqrt(variance);

            for (let i = 1; i <= forecastMonths; i++) {
                const forecastMonth = new Date(lastMonth);
                forecastMonth.setMonth(forecastMonth.getMonth() + i);
                const monthKey = forecastMonth.toISOString().substring(0, 7);

                const predictedValue = intercept + slope * (n + i);
                const lowerBound = Math.max(0, predictedValue - 1.96 * stdDev);
                const upperBound = predictedValue + 1.96 * stdDev;

                forecast.push({
                    period: monthKey,
                    value: Math.round(predictedValue),
                    lowerBound: Math.round(lowerBound),
                    upperBound: Math.round(upperBound),
                });
            }

            return { forecast, error: null };
        } catch (error) {
            return {
                forecast: [],
                error: error instanceof Error ? error.message : 'Revenue forecasting failed',
            };
        }
    },

    /**
     * Predict client churn
     */
    async predictClientChurn(clientId: string): Promise<{ prediction: Prediction | null; error: string | null }> {
        try {
            // Get client activity data
            const { data: projects } = await supabase
                .from('projects')
                .select('status, updated_at, created_at')
                .eq('owner_id', clientId);

            const { data: messages } = await supabase
                .from('messages')
                .select('created_at')
                .or(`sender_id.eq.${clientId},recipient_id.eq.${clientId}`)
                .order('created_at', { ascending: false })
                .limit(1);

            if (!projects || projects.length === 0) {
                return {
                    prediction: {
                        type: 'churn',
                        value: 0.3, // 30% churn risk for new clients
                        confidence: 0.5,
                        factors: ['New client with no project history'],
                        timestamp: new Date().toISOString(),
                    },
                    error: null,
                };
            }

            // Calculate inactivity period
            const lastActivity = messages && messages.length > 0
                ? new Date(messages[0]?.created_at ?? Date.now())
                : projects[0]?.updated_at
                    ? new Date(projects[0].updated_at)
                    : new Date(projects[0]?.created_at ?? Date.now());

            const daysSinceActivity = Math.ceil(
                (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Calculate churn risk
            let churnRisk = 0;
            const factors: string[] = [];

            if (daysSinceActivity > 90) {
                churnRisk += 0.5;
                factors.push('No activity for 90+ days');
            } else if (daysSinceActivity > 60) {
                churnRisk += 0.3;
                factors.push('No activity for 60+ days');
            } else if (daysSinceActivity > 30) {
                churnRisk += 0.15;
                factors.push('No activity for 30+ days');
            }

            const activeProjects = projects.filter(p => p.status === 'Active').length;
            if (activeProjects === 0) {
                churnRisk += 0.3;
                factors.push('No active projects');
            }

            const completedProjects = projects.filter(p => p.status === 'Completed').length;
            if (completedProjects === 0) {
                churnRisk += 0.1;
                factors.push('No completed projects');
            }

            return {
                prediction: {
                    type: 'churn',
                    value: Math.min(1, churnRisk),
                    confidence: 0.7,
                    factors: factors.length > 0 ? factors : ['Low risk client'],
                    timestamp: new Date().toISOString(),
                },
                error: null,
            };
        } catch (error) {
            return {
                prediction: null,
                error: error instanceof Error ? error.message : 'Churn prediction failed',
            };
        }
    },

    /**
     * Forecast resource demand
     */
    async forecastResourceDemand(weeks: number = 4): Promise<{ forecast: Forecast[]; error: string | null }> {
        try {
            // Get active projects and their resource needs
            const { data: projects } = await supabase
                .from('projects')
                .select('id, name, status, progress, due_date, current_stage')
                .eq('status', 'Active');

            if (!projects || projects.length === 0) {
                return { forecast: [], error: null };
            }

            // Estimate resource demand per week
            const forecast: Forecast[] = [];
            const now = new Date();

            for (let week = 0; week < weeks; week++) {
                const weekStart = new Date(now);
                weekStart.setDate(weekStart.getDate() + week * 7);

                // Count projects active in this week
                const activeInWeek = projects.filter((p: any) => {
                    if (!p.due_date) return true;
                    const dueDate = new Date(p.due_date);
                    return dueDate >= weekStart;
                }).length;

                forecast.push({
                    period: `Week ${week + 1}`,
                    value: activeInWeek,
                });
            }

            return { forecast, error: null };
        } catch (error) {
            return {
                forecast: [],
                error: error instanceof Error ? error.message : 'Resource demand forecasting failed',
            };
        }
    },

    /**
     * Calculate budget variance
     */
    async calculateBudgetVariance(projectId: string): Promise<{ variance: number; prediction: Prediction | null; error: string | null }> {
        try {
            const { data: project } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (!project) {
                return { variance: 0, prediction: null, error: 'Project not found' };
            }

            // Get invoices for this project
            const { data: invoices } = await supabase
                .from('invoices')
                .select('amount, status')
                .eq('project_id', projectId);

            const totalSpent = (invoices || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);
            const budget = project.budget || 0;
            const variance = budget > 0 ? ((totalSpent - budget) / budget) * 100 : 0;

            return {
                variance,
                prediction: {
                    type: 'budget_variance',
                    value: variance,
                    confidence: 0.9,
                    factors: [
                        `Budget: $${budget.toLocaleString()}`,
                        `Spent: $${totalSpent.toLocaleString()}`,
                        variance > 0 ? 'Over budget' : 'Under budget',
                    ],
                    timestamp: new Date().toISOString(),
                },
                error: null,
            };
        } catch (error) {
            return {
                variance: 0,
                prediction: null,
                error: error instanceof Error ? error.message : 'Budget variance calculation failed',
            };
        }
    },

    /**
     * Assess project risk
     */
    async assessProjectRisk(projectId: string): Promise<{ prediction: Prediction | null; error: string | null }> {
        try {
            const { data: project } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (!project) {
                return { prediction: null, error: 'Project not found' };
            }

            let riskScore = 0;
            const factors: string[] = [];

            // Check overdue
            if (project.due_date) {
                const dueDate = new Date(project.due_date);
                if (dueDate < new Date()) {
                    riskScore += 0.4;
                    factors.push('Project is overdue');
                } else {
                    const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    if (daysUntilDue < 7) {
                        riskScore += 0.2;
                        factors.push('Due date approaching');
                    }
                }
            }

            // Check progress vs time elapsed
            const progress = project.progress || 0;
            if (project.created_at) {
                const created = new Date(project.created_at);
                const daysElapsed = Math.ceil((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
                const expectedProgress = Math.min(100, (daysElapsed / 30) * 100); // Assume 30-day project

                if (progress < expectedProgress * 0.7) {
                    riskScore += 0.3;
                    factors.push('Progress behind schedule');
                }
            }

            // Check budget variance
            const { variance } = await this.calculateBudgetVariance(projectId);
            if (variance > 20) {
                riskScore += 0.2;
                factors.push('Significant budget overrun');
            }

            // Check status
            if (project.status === 'On Hold') {
                riskScore += 0.3;
                factors.push('Project on hold');
            }

            return {
                prediction: {
                    type: 'risk',
                    value: Math.min(1, riskScore),
                    confidence: 0.8,
                    factors: factors.length > 0 ? factors : ['Low risk project'],
                    timestamp: new Date().toISOString(),
                },
                error: null,
            };
        } catch (error) {
            return {
                prediction: null,
                error: error instanceof Error ? error.message : 'Risk assessment failed',
            };
        }
    },
};

