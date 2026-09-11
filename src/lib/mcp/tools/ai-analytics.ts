import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { strategicAuditService } from '@/services/StrategicAuditService';
import { dealProbabilityService } from '@/services/dealProbabilityService';

// 1. run_strategic_pnl_audit
registerTool('ai-analytics', {
  name: 'run_strategic_pnl_audit',
  description: 'Run an automated P&L audit on the tenant workspace data, identifying anomalies and revenue optimization paths.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabaseAdmin = createSupabaseAdminClient();
    const { snapshot, error } = await strategicAuditService.getSnapshot(args.tenant_id, supabaseAdmin);
    if (error) throw new Error(error);
    if (!snapshot) throw new Error('Could not retrieve business snapshot.');

    const totalDealsValue = snapshot.deals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const weightedPipeline = snapshot.summary.weighted_pipeline_value || 0;
    const monthlyRevenue = snapshot.summary.revenue_monthly_actual || 0;
    const monthlyGoal = snapshot.goals?.monthly_revenue_goal || 0;

    // Build automated financial audit findings
    const findings = [
      `Monthly Revenue Goal: $${monthlyGoal.toLocaleString()}`,
      `Actual Monthly Revenue: $${monthlyRevenue.toLocaleString()} (${snapshot.progress}% of goal)`,
      `Total Deals Pipeline Value: $${totalDealsValue.toLocaleString()}`,
      `Weighted Pipeline Value: $${weightedPipeline.toLocaleString()}`,
      `Total Outstanding Invoices: $${snapshot.invoices.reduce((sum, i) => sum + (i.total || 0), 0).toLocaleString()}`,
    ];

    const recommendations = [];
    if (monthlyRevenue < monthlyGoal * 0.5) {
      recommendations.push('HIGH ALERT: Actual monthly revenue is below 50% of the target. Focus on closing high-probability negotiation stage deals.');
    }
    if (weightedPipeline < monthlyGoal) {
      recommendations.push('WARNING: Weighted pipeline value is insufficient to cover the monthly revenue goal. Generate new pipeline immediately.');
    }
    if (snapshot.invoices.length > 3) {
      recommendations.push('ACTION REQUIRED: There are multiple outstanding invoices. Send friendly reminders or trigger collection workflows.');
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      summary: findings,
      recommendations: recommendations.length > 0 ? recommendations : ['All business metrics are currently within stable healthy thresholds.'],
      raw_snapshot: {
        summary: snapshot.summary,
        goals: snapshot.goals,
        progress: snapshot.progress,
      },
    };
  },
});

// 2. predict_deal_win_probability
registerTool('ai-analytics', {
  name: 'predict_deal_win_probability',
  description: 'Evaluate deal win probability using Bayesian updates based on key sales indicators.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    deal_id: z.string().uuid(),
    factors: z.object({
      engagementScore: z.number().int().min(0).max(100).optional(),
      timeInStage: z.number().int().nonnegative().optional(),
      budgetConfirmed: z.boolean().optional(),
      decisionMakerEngaged: z.boolean().optional(),
      competitorPresent: z.boolean().optional(),
    }).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      deal_id: { type: 'string', format: 'uuid' },
      factors: {
        type: 'object',
        properties: {
          engagementScore: { type: 'number', minimum: 0, maximum: 100 },
          timeInStage: { type: 'number', minimum: 0 },
          budgetConfirmed: { type: 'boolean' },
          decisionMakerEngaged: { type: 'boolean' },
          competitorPresent: { type: 'boolean' },
        },
      },
    },
    required: ['tenant_id', 'deal_id'],
  },
  handler: async (args) => {
    const supabaseAdmin = createSupabaseAdminClient();

    // Fetch the deal (we'll fetch from the leads table where the deal resides)
    const { data: deal, error: dealError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', args.deal_id)
      .eq('tenant_id', args.tenant_id)
      .single();

    if (dealError) throw dealError;
    if (!deal) throw new Error('Deal/lead not found.');

    // Map lead fields to the Deal interface required by dealProbabilityService
    const dealForService = {
      id: deal.id,
      name: deal.business_name || '',
      client_id: deal.client_id || '',
      value: deal.value || 0,
      stage: deal.stage || 'lead',
      probability: deal.probability || 0,
      expected_close_date: deal.expected_close_date || '',
      created_at: deal.created_at,
      updated_at: deal.updated_at,
    };

    const calculatedProbability = dealProbabilityService.calculateProbability(
      dealForService as any,
      args.factors || {}
    );

    // Get recommendations from factors
    const recommendations = [];
    const factors = args.factors || {};
    if (factors.decisionMakerEngaged === false) {
      recommendations.push('Decision maker is not engaged. Set up a meeting with the primary stakeholder.');
    }
    if (factors.budgetConfirmed === false) {
      recommendations.push('Budget has not been confirmed. Qualify financial feasibility immediately.');
    }
    if (factors.competitorPresent === true) {
      recommendations.push('A competitor is active in this deal. Highlight unique differentiators and testimonials.');
    }
    if (factors.engagementScore !== undefined && factors.engagementScore < 40) {
      recommendations.push('Buyer engagement score is low. Follow up with relevant educational materials or case studies.');
    }

    return {
      deal_id: deal.id,
      deal_name: deal.business_name,
      current_stage: deal.stage,
      prior_probability: deal.probability,
      calculated_probability: calculatedProbability,
      factors_applied: factors,
      recommendations: recommendations.length > 0 ? recommendations : ['Maintain regular touchpoints to close this deal.'],
    };
  },
});

// 3. recommend_next_steps
registerTool('ai-analytics', {
  name: 'recommend_next_steps',
  description: 'Analyze all deals, tasks, and outstanding items to generate a ranked list of next best actions.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabaseAdmin = createSupabaseAdminClient();
    const { snapshot, error } = await strategicAuditService.getSnapshot(args.tenant_id, supabaseAdmin);
    if (error) throw new Error(error);
    if (!snapshot) throw new Error('Could not retrieve business snapshot.');

    const recommendations = [];

    // Analyze high value deals at negotiation or proposal stage
    const openDeals = snapshot.deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
    for (const deal of openDeals) {
      if (deal.amount >= 10000 && deal.probability < 60) {
        recommendations.push({
          priority: 'HIGH',
          action: `Unblock high-value deal "${deal.name}" ($${deal.amount.toLocaleString()}) currently at "${deal.stage}" stage. Current close probability is only ${deal.probability}%.`,
          context: { deal_id: deal.id, type: 'deal_win_optimization' },
        });
      }
    }

    // Analyze overdue tasks
    const now = new Date();
    const tasks = snapshot.tasks;
    for (const task of tasks) {
      const dueDate = new Date(task.dueDate);
      if (dueDate < now && task.status !== 'completed') {
        recommendations.push({
          priority: task.priority === 'high' ? 'HIGH' : 'MEDIUM',
          action: `Complete overdue task: "${task.title}". Was due on ${dueDate.toLocaleDateString()}.`,
          context: { task_id: task.id, type: 'overdue_task' },
        });
      }
    }

    // Analyze unpaid invoices past due
    const invoices = snapshot.invoices;
    for (const invoice of invoices) {
      const dueDate = new Date(invoice.dueDate);
      if (dueDate < now && invoice.status !== 'paid') {
        recommendations.push({
          priority: 'HIGH',
          action: `Follow up on unpaid overdue invoice #${invoice.invoiceNumber} ($${invoice.total.toLocaleString()}). Was due on ${dueDate.toLocaleDateString()}.`,
          context: { invoice_id: invoice.id, type: 'unpaid_invoice' },
        });
      }
    }

    // Sort by priority
    recommendations.sort((a, b) => {
      const prioOrder: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
      return prioOrder[a.priority] - prioOrder[b.priority];
    });

    return {
      tenant_id: args.tenant_id,
      generated_at: new Date().toISOString(),
      recommended_actions: recommendations.slice(0, 10), // return top 10 actions
    };
  },
});
