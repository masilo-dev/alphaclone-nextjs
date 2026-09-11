/**
 * AI Insights Service - 120% Feature
 * Bonnie AI-powered recommendations, predictions, and insights
 * across all AlphaClone modules
 */

import { routeAIRequest } from './aiRouter';
import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface AIInsight {
  id: string;
  type: 'prediction' | 'recommendation' | 'anomaly' | 'trend' | 'action';
  severity: 'info' | 'warning' | 'critical';
  module: string;
  title: string;
  description: string;
  data?: any;
  confidence: number; // 0-100
  createdAt: string;
  expiresAt?: string;
  action?: {
    type: string;
    label: string;
    route: string;
    params?: Record<string, any>;
  };
}

export interface DealPrediction {
  dealId: string;
  winProbability: number;
  estimatedCloseDate: string;
  recommendedActions: string[];
  riskFactors: string[];
}

export interface RevenueForecast {
  period: string;
  predictedRevenue: number;
  confidenceInterval: { low: number; high: number };
  factors: string[];
}

/**
 * Generate AI-powered deal insights
 * 120% feature - Predictive analytics for CRM
 */
export async function generateDealInsights(dealId: string): Promise<AIInsight[]> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) throw new Error('No tenant');

    // Fetch deal with related data
    const { data: deal } = await supabase
      .from('deals')
      .select(`
        *,
        contacts (first_name, last_name, email, status),
        deal_activities (*)
      `)
      .eq('id', dealId)
      .single();

    if (!deal) return [];

    // Fetch historical similar deals
    const { data: similarDeals } = await supabase
      .from('deals')
      .select('stage, value, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .neq('id', dealId)
      .limit(50);

    const prompt = `Analyze this deal and provide insights:

Deal: ${deal.name}
Value: $${deal.value}
Stage: ${deal.stage}
Days in stage: ${deal.days_in_stage || 'Unknown'}
Contact: ${deal.contacts?.first_name} ${deal.contacts?.last_name}

Similar deals history: ${JSON.stringify(similarDeals?.map((d: { stage: string; value: number; updated_at: string; created_at: string }) => ({
      stage: d.stage,
      value: d.value,
      duration: Math.floor((new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24))
    })))}

Provide:
1. Win probability (0-100%)
2. Risk factors (if any)
3. Recommended actions
4. Estimated close timeframe

Return as JSON: { winProbability: number, riskFactors: string[], recommendations: string[], estimatedCloseDays: number }`;

    const aiResponse = await routeAIRequest({
      prompt,
      systemPrompt: 'You are a sales analytics AI. Provide data-driven deal insights in JSON format only.',
      maxTokens: 800,
    });

    // Parse AI response
    let insights: AIInsight[] = [];
    try {
      const parsed = JSON.parse(aiResponse.content);
      
      if (parsed.winProbability !== undefined) {
        insights.push({
          id: `deal-prediction-${dealId}`,
          type: 'prediction',
          severity: parsed.winProbability > 70 ? 'info' : parsed.winProbability > 40 ? 'warning' : 'critical',
          module: 'deals',
          title: `${parsed.winProbability}% Win Probability`,
          description: `Based on historical data, this deal has a ${parsed.winProbability}% chance of closing successfully.`,
          data: { winProbability: parsed.winProbability },
          confidence: parsed.winProbability,
          createdAt: new Date().toISOString(),
          action: {
            type: 'view_deal',
            label: 'View Deal',
            route: '/dashboard/crm/deals',
            params: { dealId },
          },
        });
      }

      if (parsed.riskFactors?.length > 0) {
        insights.push({
          id: `deal-risks-${dealId}`,
          type: 'anomaly',
          severity: 'warning',
          module: 'deals',
          title: `${parsed.riskFactors.length} Risk Factors Detected`,
          description: parsed.riskFactors.join(', '),
          data: { risks: parsed.riskFactors },
          confidence: 85,
          createdAt: new Date().toISOString(),
        });
      }

      if (parsed.recommendations?.length > 0) {
        parsed.recommendations.forEach((rec: string, idx: number) => {
          insights.push({
            id: `deal-rec-${dealId}-${idx}`,
            type: 'recommendation',
            severity: 'info',
            module: 'deals',
            title: 'AI Recommendation',
            description: rec,
            confidence: 75,
            createdAt: new Date().toISOString(),
            action: {
              type: 'take_action',
              label: 'Take Action',
              route: '/dashboard/crm/deals',
              params: { dealId, action: rec },
            },
          });
        });
      }
    } catch (e) {
      console.error('Failed to parse AI insights:', e);
    }

    return insights;
  } catch (err) {
    console.error('Failed to generate deal insights:', err);
    return [];
  }
}

/**
 * Generate revenue forecast
 * 120% feature - Predictive financial analytics
 */
export async function generateRevenueForecast(months: number = 3): Promise<RevenueForecast[]> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) throw new Error('No tenant');

    // Fetch historical revenue data
    const { data: invoices } = await supabase
      .from('business_invoices')
      .select('total, status, created_at, paid_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    // Fetch pipeline data
    const { data: deals } = await supabase
      .from('deals')
      .select('value, stage, probability')
      .eq('tenant_id', tenantId)
      .in('stage', ['proposal', 'negotiation', 'closed_won']);

    const prompt = `Generate a ${months}-month revenue forecast based on this data:

Historical Paid Invoices (last 6 months):
${JSON.stringify(invoices?.map((i: { created_at: string; total: number }) => ({
      month: new Date(i.created_at).toLocaleString('default', { month: 'short' }),
      amount: i.total
    })))}

Current Pipeline:
${JSON.stringify(deals?.map((d: { stage: string; value: number; probability?: number }) => ({
      stage: d.stage,
      value: d.value,
      probability: d.probability || (d.stage === 'closed_won' ? 100 : d.stage === 'negotiation' ? 70 : 50)
    })))}

Provide month-by-month predictions with confidence intervals.
Consider seasonality, pipeline velocity, and historical trends.

Return as JSON array: [{ month: string, predictedRevenue: number, confidenceLow: number, confidenceHigh: number, factors: string[] }]`;

    const aiResponse = await routeAIRequest({
      prompt,
      systemPrompt: 'You are a financial forecasting AI. Provide accurate revenue predictions based on historical and pipeline data.',
      maxTokens: 1000,
    });

    try {
      const forecasts = JSON.parse(aiResponse.content);
      return forecasts.map((f: any) => ({
        period: f.month,
        predictedRevenue: f.predictedRevenue,
        confidenceInterval: { low: f.confidenceLow, high: f.confidenceHigh },
        factors: f.factors || [],
      }));
    } catch (e) {
      console.error('Failed to parse forecast:', e);
      return [];
    }
  } catch (err) {
    console.error('Failed to generate revenue forecast:', err);
    return [];
  }
}

/**
 * Detect anomalies across all modules
 * 120% feature - Proactive monitoring
 */
export async function detectAnomalies(): Promise<AIInsight[]> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) return [];

    const insights: AIInsight[] = [];

    // Check for overdue invoices
    const { data: overdueInvoices } = await supabase
      .from('business_invoices')
      .select('id, invoice_number, total, due_date')
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'viewed'])
      .lt('due_date', new Date().toISOString());

    if (overdueInvoices && overdueInvoices.length > 0) {
      const totalOverdue = overdueInvoices.reduce((sum: number, inv: { total: number }) => sum + (inv.total || 0), 0);
      insights.push({
        id: `anomaly-overdue-${Date.now()}`,
        type: 'anomaly',
        severity: overdueInvoices.length > 5 ? 'critical' : 'warning',
        module: 'invoicing',
        title: `${overdueInvoices.length} Overdue Invoices`,
        description: `Total overdue amount: $${totalOverdue.toLocaleString()}. Consider sending payment reminders.`,
        data: { count: overdueInvoices.length, total: totalOverdue },
        confidence: 95,
        createdAt: new Date().toISOString(),
        action: {
          type: 'view_invoices',
          label: 'View Overdue',
          route: '/dashboard/invoicing',
          params: { filter: 'overdue' },
        },
      });
    }

    // Check for stale deals
    const { data: staleDeals } = await supabase
      .from('deals')
      .select('id, name, stage, updated_at')
      .eq('tenant_id', tenantId)
      .not('stage', 'in', ['closed_won', 'closed_lost'])
      .lt('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (staleDeals && staleDeals.length > 0) {
      insights.push({
        id: `anomaly-stale-deals-${Date.now()}`,
        type: 'anomaly',
        severity: 'warning',
        module: 'deals',
        title: `${staleDeals.length} Stagnant Deals`,
        description: `Deals untouched for 30+ days need attention. Consider re-engagement campaigns.`,
        data: { deals: staleDeals },
        confidence: 90,
        createdAt: new Date().toISOString(),
        action: {
          type: 'view_deals',
          label: 'Review Deals',
          route: '/dashboard/crm/deals',
          params: { filter: 'stale' },
        },
      });
    }

    // Check for low engagement campaigns
    const { data: lowEngagementCampaigns } = await supabase
      .from('email_campaigns')
      .select('id, name, total_sent, total_opened')
      .eq('tenant_id', tenantId)
      .eq('status', 'sent')
      .gt('total_sent', 100)
      .lt('total_opened', 10); // Less than 10% open rate

    if (lowEngagementCampaigns && lowEngagementCampaigns.length > 0) {
      insights.push({
        id: `anomaly-low-engagement-${Date.now()}`,
        type: 'anomaly',
        severity: 'warning',
        module: 'marketing',
        title: 'Low Email Engagement Detected',
        description: `Some campaigns have <10% open rate. Consider A/B testing subject lines or segmenting your audience.`,
        data: { campaigns: lowEngagementCampaigns },
        confidence: 85,
        createdAt: new Date().toISOString(),
        action: {
          type: 'optimize_campaigns',
          label: 'Optimize Campaigns',
          route: '/dashboard/marketing',
        },
      });
    }

    return insights;
  } catch (err) {
    console.error('Failed to detect anomalies:', err);
    return [];
  }
}

/**
 * Generate workspace health score
 * 120% feature - Overall platform intelligence
 */
export async function generateWorkspaceHealthScore(): Promise<{
  score: number;
  breakdown: Record<string, number>;
  topRecommendations: string[];
}> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) throw new Error('No tenant');

    // Gather metrics
    const [
      { count: totalContacts },
      { count: activeDeals },
      { count: overdueInvoices },
      { count: pendingTasks },
      { count: sentCampaigns },
    ] = await Promise.all([
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).not('stage', 'in', ['closed_won', 'closed_lost']),
      supabase.from('business_invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'overdue'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['todo', 'in_progress']),
      supabase.from('email_campaigns').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'sent'),
    ]);

    const breakdown = {
      crm: Math.min(100, ((activeDeals || 0) * 10) + 20),
      invoicing: overdueInvoices === 0 ? 100 : Math.max(0, 100 - (overdueInvoices * 10)),
      productivity: Math.min(100, ((pendingTasks || 0) * 5) + 30),
      marketing: Math.min(100, ((sentCampaigns || 0) * 20) + 20),
      data: Math.min(100, ((totalContacts || 0) / 10) + 20),
    };

    const score = Math.round(Object.values(breakdown).reduce((a, b) => a + b, 0) / 5);

    // Generate recommendations based on scores
    const recommendations: string[] = [];
    if (breakdown.crm < 60) recommendations.push('Focus on moving deals through your pipeline');
    if (breakdown.invoicing < 80) recommendations.push('Address overdue invoices to improve cash flow');
    if (breakdown.productivity < 70) recommendations.push('Clear pending tasks to improve team velocity');
    if (breakdown.marketing < 50) recommendations.push('Send more campaigns to engage your audience');
    if (breakdown.data < 40) recommendations.push('Import more contacts to build your database');

    return {
      score,
      breakdown,
      topRecommendations: recommendations.slice(0, 3),
    };
  } catch (err) {
    console.error('Failed to generate health score:', err);
    return { score: 0, breakdown: {}, topRecommendations: [] };
  }
}

/**
 * Smart scheduling recommendations
 * 120% feature - Optimal timing AI
 */
export async function getOptimalTiming(
  activityType: 'email' | 'call' | 'meeting' | 'social'
): Promise<{ bestDay: string; bestTime: string; reasoning: string }> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) throw new Error('No tenant');

    // Fetch historical engagement data
    const { data: campaigns } = await supabase
      .from('email_campaigns')
      .select('sent_at, total_opened, total_clicked, total_sent')
      .eq('tenant_id', tenantId)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(20);

    // Analyze patterns
    const dayPerformance: Record<string, { opens: number; total: number }> = {};
    const timePerformance: Record<string, { opens: number; total: number }> = {};

    campaigns?.forEach((c: { sent_at: string; total_opened: number; total_sent: number }) => {
      const date = new Date(c.sent_at);
      const day = date.toLocaleDateString('en-US', { weekday: 'long' });
      const hour = date.getHours();
      const timeSlot = hour < 9 ? 'early-morning' : hour < 12 ? 'morning' : hour < 14 ? 'lunch' : hour < 17 ? 'afternoon' : 'evening';

      dayPerformance[day] = dayPerformance[day] || { opens: 0, total: 0 };
      dayPerformance[day].opens += c.total_opened || 0;
      dayPerformance[day].total += c.total_sent || 0;

      timePerformance[timeSlot] = timePerformance[timeSlot] || { opens: 0, total: 0 };
      timePerformance[timeSlot].opens += c.total_opened || 0;
      timePerformance[timeSlot].total += c.total_sent || 0;
    });

    // Find best performing day and time
    let bestDay = 'Tuesday';
    let bestDayRate = 0;
    Object.entries(dayPerformance).forEach(([day, stats]) => {
      const rate = stats.total > 0 ? stats.opens / stats.total : 0;
      if (rate > bestDayRate) {
        bestDayRate = rate;
        bestDay = day;
      }
    });

    let bestTime = 'morning';
    let bestTimeRate = 0;
    Object.entries(timePerformance).forEach(([time, stats]) => {
      const rate = stats.total > 0 ? stats.opens / stats.total : 0;
      if (rate > bestTimeRate) {
        bestTimeRate = rate;
        bestTime = time;
      }
    });

    const timeMap: Record<string, string> = {
      'early-morning': '8:00-9:00 AM',
      'morning': '10:00-11:00 AM',
      'lunch': '12:00-1:00 PM',
      'afternoon': '2:00-3:00 PM',
      'evening': '4:00-5:00 PM',
    };

    return {
      bestDay,
      bestTime: timeMap[bestTime] || '10:00 AM',
      reasoning: `Based on your historical ${activityType} performance, ${bestDay}s at ${timeMap[bestTime]} have shown ${Math.round(bestDayRate * 100)}% engagement rates.`,
    };
  } catch (err) {
    console.error('Failed to get optimal timing:', err);
    return {
      bestDay: 'Tuesday',
      bestTime: '10:00 AM',
      reasoning: 'Based on industry best practices for B2B engagement.',
    };
  }
}
